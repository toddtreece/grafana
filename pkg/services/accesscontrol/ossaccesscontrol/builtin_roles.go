package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const roleGrafanaAdmin = "Grafana Admin"

var builtInRolesMap = map[string]accesscontrol.RoleDTO{
	"grafana:builtin:users:read:self": {
		Name:    "grafana:builtin:users:read:self",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			{
				Action: "users:read",
				Scope:  accesscontrol.ScopeUsersSelf,
			},
			{
				Action: "users.tokens:list",
				Scope:  accesscontrol.ScopeUsersSelf,
			},
			{
				Action: "users.teams:read",
				Scope:  accesscontrol.ScopeUsersSelf,
			},
		},
	},
	"roles:adminUsers:viewer": {
		Name:    "roles:adminUsers:viewer",
		Version: 2,
		Permissions: []accesscontrol.Permission{
			// {
			// 	Action: accesscontrol.ActionUsersAuthTokenList,
			// 	Scope:      accesscontrol.ScopeUsersAll,
			// },
			{
				Action: accesscontrol.ActionUsersRead,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersTeamRead,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersQuotasList,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersCreate,
				Scope:  accesscontrol.ScopeUsersAll,
			},
		},
	},
	"roles:adminUsers:editor": {
		Name:    "roles:adminUsers:editor",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			// {
			// 	Action: accesscontrol.ActionUsersAuthTokenList,
			// 	Scope:      accesscontrol.ScopeUsersAll,
			// },
			{
				Action: accesscontrol.ActionUsersPasswordUpdate,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersCreate,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersDelete,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersEnable,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersDisable,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersPermissionsUpdate,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersLogout,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersAuthTokenUpdate,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersQuotasList,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersQuotasUpdate,
				Scope:  accesscontrol.ScopeUsersAll,
			},
		},
	},
}

var builtInRoleGrants = map[string][]string{
	"Viewer": {
		"grafana:builtin:users:read:self",
	},
	"Admin": {
		"roles:adminUsers:editor",
	},
	"Editor": {
		"grafana:builtin:users:read:self",
		"roles:adminUsers:viewer",
	},
}

func getBuiltInRole(role string) *accesscontrol.RoleDTO {
	var builtInRole accesscontrol.RoleDTO
	if r, ok := builtInRolesMap[role]; ok {
		// Do not modify builtInRoles
		builtInRole = r
		return &builtInRole
	}
	return nil
}
