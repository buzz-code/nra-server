import { AuthOptions } from "@dataui/crud";

type AuthWithFunc = (permissionsFunc: (permissions: any) => boolean) => AuthOptions;

export const CrudAuthFilter: AuthOptions = {
    filter: (user) => user.permissions.admin
        ? ({})
        : ({
            userId: user.effective_id || user.id,
        })
};

export const CrudAuthAdminFilter: AuthOptions = {
    filter: (user) => user.permissions.admin
        ? ({})
        : ({ id: -1 })
}

export const CrudAuthWithPermissionsFilter: AuthWithFunc = (permissionsFunc) => ({
    filter: (user) => user.permissions.admin || permissionsFunc(user.permissions)
        ? ({})
        : ({ id: -1 })
})

export const CrudAuthReadOnlyWithPermissionFunc: AuthWithFunc = (permissionsFunc) => ({
    filter: CrudAuthFilter.filter,
    persist: (user) => user.permissions.admin || permissionsFunc(user.permissions)
        ? ({})
        : ({ id: 'break' })
})
