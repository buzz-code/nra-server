import { AuthOptions } from "@dataui/crud";
import { getUserIdFromUser } from "./auth.util";

type AuthWithFunc = (permissionsFunc: (permissions: any) => boolean) => AuthOptions;

export const CrudAuthFilter: AuthOptions = {
    filter: (user) => user.permissions.admin
        ? ({})
        : ({
            userId: getUserIdFromUser(user),
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
    persist: (user) => user.permissions.admin || permissionsFunc(user.permissions)
        ? ({})
        : ({ id: 'break' })
})
