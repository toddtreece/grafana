package provisioning

import (
	"context"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	plugifaces "github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
	"github.com/grafana/grafana/pkg/services/provisioning/notifiers"
	"github.com/grafana/grafana/pkg/services/provisioning/plugins"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type ProvisioningService interface {
	RunInitProvisioners() error
	RunProvisioner(provisionerUID string) error
	GetProvisionerResolvedPath(provisionerUID, name string) (string, error)
	GetAllowUIUpdatesFromConfig(provisionerUID, name string) (bool, error)
	registry.BackgroundService
}

func init() {
	registry.Register(&registry.Descriptor{
		Name: "ProvisioningService",
		Instance: newProvisioningServiceImpl(
			dashboards.New,
			notifiers.Provision,
			datasources.Provision,
			plugins.Provision,
		),
		InitPriority: registry.Low,
	})
}

// ToDo make a better instantiation of the provisioning service.

// NewProvisioningServiceImpl creates a new instance of a ProvisioningService
// without relying on facebook's inject fwk
func NewProvisioningServiceImpl(
	cfg *setting.Cfg,
	requestHandler plugifaces.DataRequestHandler,
	sqlStore *sqlstore.SQLStore,
	pluginManager plugifaces.Manager,
) *ProvisioningServiceImpl {
	return &ProvisioningServiceImpl{
		log:                     log.New("provisioning"),
		newDashboardProvisioner: dashboards.New,
		provisionNotifiers:      notifiers.Provision,
		provisionDatasources:    datasources.Provision,
		provisionPlugins:        plugins.Provision,
		Cfg:                     cfg,
		RequestHandler:          requestHandler,
		SQLStore:                sqlStore,
		PluginManager:           pluginManager,
	}
}

func newProvisioningServiceImpl(
	newDashboardProvisioner dashboards.DashboardProvisionerFactory,
	provisionNotifiers func(string) error,
	provisionDatasources func(string) error,
	provisionPlugins func(string, plugifaces.Manager) error,
) *ProvisioningServiceImpl {
	return &ProvisioningServiceImpl{
		log:                     log.New("provisioning"),
		newDashboardProvisioner: newDashboardProvisioner,
		provisionNotifiers:      provisionNotifiers,
		provisionDatasources:    provisionDatasources,
		provisionPlugins:        provisionPlugins,
	}
}

type ProvisioningServiceImpl struct {
	Cfg                     *setting.Cfg                  `inject:""`
	RequestHandler          plugifaces.DataRequestHandler `inject:""`
	SQLStore                *sqlstore.SQLStore            `inject:""`
	PluginManager           plugifaces.Manager            `inject:""`
	log                     log.Logger
	pollingCtxCancel        context.CancelFunc
	newDashboardProvisioner dashboards.DashboardProvisionerFactory
	dashboardProvisioner    dashboards.DashboardProvisioner
	provisionNotifiers      func(string) error
	provisionDatasources    func(string) error
	provisionPlugins        func(string, plugifaces.Manager) error
	mutex                   sync.Mutex
}

func (ps *ProvisioningServiceImpl) Init() error {
	return ps.RunInitProvisioners()
}

func (ps *ProvisioningServiceImpl) RunInitProvisioners() error {
	err := ps.wrapProvisionDatasources()
	if err != nil {
		return err
	}

	err = ps.wrapProvisionPlugins()
	if err != nil {
		return err
	}

	err = ps.wrapProvisionNotifications()
	if err != nil {
		return err
	}

	return nil
}

func (ps *ProvisioningServiceImpl) Run(ctx context.Context) error {
	err := ps.wrapProvisionDashboards()
	if err != nil {
		ps.log.Error("Failed to provision dashboard", "error", err)
		return err
	}

	for {
		// Wait for unlock. This is tied to new dashboardProvisioner to be instantiated before we start polling.
		ps.mutex.Lock()
		// Using background here because otherwise if root context was canceled the select later on would
		// non-deterministically take one of the route possibly going into one polling loop before exiting.
		pollingContext, cancelFun := context.WithCancel(context.Background())
		ps.pollingCtxCancel = cancelFun
		ps.dashboardProvisioner.PollChanges(pollingContext)
		ps.mutex.Unlock()

		select {
		case <-pollingContext.Done():
			// Polling was canceled.
			continue
		case <-ctx.Done():
			// Root server context was cancelled so cancel polling and leave.
			ps.cancelPolling()
			return ctx.Err()
		}
	}
}

func (ps *ProvisioningServiceImpl) RunProvisioner(provisionerUID string) error {
	switch provisionerUID {
	case DashboardsProvisionerUID:
		return ps.wrapProvisionDashboards()
	case DatasourcesProvisionerUID:
		return ps.wrapProvisionDatasources()
	case NotificationsProvisionerUID:
		return ps.wrapProvisionNotifications()
	case PluginsProvisionerUID:
		return ps.wrapProvisionPlugins()
	default:
		return ErrUnknownProvisioner
	}
}

func (ps *ProvisioningServiceImpl) wrapProvisionDatasources() error {
	datasourcePath := filepath.Join(ps.Cfg.ProvisioningPath, "datasources")
	err := ps.provisionDatasources(datasourcePath)
	return errutil.Wrap("Datasource provisioning error", err)
}

func (ps *ProvisioningServiceImpl) wrapProvisionPlugins() error {
	appPath := filepath.Join(ps.Cfg.ProvisioningPath, "plugins")
	err := ps.provisionPlugins(appPath, ps.PluginManager)
	return errutil.Wrap("app provisioning error", err)
}

func (ps *ProvisioningServiceImpl) wrapProvisionNotifications() error {
	alertNotificationsPath := filepath.Join(ps.Cfg.ProvisioningPath, "notifiers")
	err := ps.provisionNotifiers(alertNotificationsPath)
	return errutil.Wrap("Alert notification provisioning error", err)
}

func (ps *ProvisioningServiceImpl) wrapProvisionDashboards() error {
	dashboardPath := filepath.Join(ps.Cfg.ProvisioningPath, "dashboards")
	dashProvisioner, err := ps.newDashboardProvisioner(dashboardPath, ps.SQLStore, ps.RequestHandler)
	if err != nil {
		return errutil.Wrap("Failed to create provisioner", err)
	}

	ps.mutex.Lock()
	defer ps.mutex.Unlock()

	ps.cancelPolling()
	dashProvisioner.CleanUpOrphanedDashboards()

	err = dashProvisioner.Provision()
	if err != nil {
		// If we fail to provision with the new provisioner, the mutex will unlock and the polling will restart with the
		// old provisioner as we did not switch them yet.
		return errutil.Wrap("Failed to provision dashboards", err)
	}
	ps.dashboardProvisioner = dashProvisioner
	return nil
}

func (ps *ProvisioningServiceImpl) GetProvisionerResolvedPath(provisionerUID, name string) (string, error) {
	switch provisionerUID {
	case DashboardsProvisionerUID:
		return ps.dashboardProvisioner.GetProvisionerResolvedPath(name), nil
	default:
		return "", ErrUnknownProvisioner
	}
}

func (ps *ProvisioningServiceImpl) GetAllowUIUpdatesFromConfig(provisionerUID, name string) (bool, error) {
	switch provisionerUID {
	case DashboardsProvisionerUID:
		return ps.dashboardProvisioner.GetAllowUIUpdatesFromConfig(name), nil
	default:
		return false, ErrUnknownProvisioner
	}
}

func (ps *ProvisioningServiceImpl) cancelPolling() {
	if ps.pollingCtxCancel != nil {
		ps.log.Debug("Stop polling for dashboard changes")
		ps.pollingCtxCancel()
	}
	ps.pollingCtxCancel = nil
}
