import { AuthOptions } from "@dataui/crud";
import { getUserIdFromUser } from "./auth.util";

type AuthWithFunc = (permissionsFunc: (permissions: any) => boolean) => AuthOptions;

const ADMIN_FILTER = {};
const NO_DATA_FILTER = { id: -1 };
const READ_ONLY_FILTER = { id: 'break' };
const getUserIdFilter = (user) => ({
    userId: getUserIdFromUser(user),
});

export const CrudAuthFilter: AuthOptions = {
    filter: (user) => user.permissions.admin
        ? ADMIN_FILTER
        : getUserIdFilter(user)
};

export const CrudAuthAdminFilter: AuthOptions = {
    filter: (user) => user.permissions.admin
        ? ADMIN_FILTER
        : NO_DATA_FILTER
}

export const CrudAuthWithPermissionsFilter: AuthWithFunc = (permissionsFunc) => ({
    filter: (user) => user.permissions.admin || permissionsFunc(user.permissions)
        ? ADMIN_FILTER
        : NO_DATA_FILTER
})

export const CrudAuthReadOnlyWithPermissionFunc: AuthWithFunc = (permissionsFunc) => ({
    persist: (user) => user.permissions.admin || permissionsFunc(user.permissions)
        ? ADMIN_FILTER
        : READ_ONLY_FILTER
})

