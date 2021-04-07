package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var builtInRolesMap = map[string]accesscontrol.RoleDTO{
	"grafana:builtin:users:read:self": {
		Name:    "grafana:builtin:users:read:self",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			{
				Permission: "users:read",
				Scope:      accesscontrol.ScopeUsersSelf,
			},
			{
				Permission: "users.tokens:list",
				Scope:      accesscontrol.ScopeUsersSelf,
			},
			{
				Permission: "users.teams:read",
				Scope:      accesscontrol.ScopeUsersSelf,
			},
		},
	},
	"roles:adminUsers:viewer": {
		Name:    "roles:adminUsers:viewer",
		Version: 2,
		Permissions: []accesscontrol.Permission{
			{
				Permission: accesscontrol.ActionUsersAuthTokenList,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersQuotasList,
				Scope:      accesscontrol.ScopeUsersAll,
			},
		},
	},
	"roles:adminUsers:editor": {
		Name:    "roles:adminUsers:editor",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			{
				Permission: accesscontrol.ActionUsersAuthTokenList,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersPasswordUpdate,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersCreate,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersDelete,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersEnable,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersDisable,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersPermissionsUpdate,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersLogout,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersAuthTokenUpdate,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersQuotasList,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersQuotasUpdate,
				Scope:      accesscontrol.ScopeUsersAll,
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
