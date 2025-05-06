import { AuthOptions } from "@dataui/crud";
import { getUserIdFromUser } from "./auth.util";

type FilterFunc = (user: any) => any;
type PermissionFunc = (permissions: any) => boolean;
type AuthWith<T, U = never> = (func1: T, func2?: U) => AuthOptions;
type AuthWithFilterFunc = AuthWith<FilterFunc>;
type AuthWithPermissionFunc = AuthWith<PermissionFunc>;

export const ADMIN_FILTER = {};
export const NO_DATA_FILTER = { id: -1 };
export const READ_ONLY_FILTER = { id: 'break' };
export const getUserIdFilter = (user) => ({
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

export const CrudAuthWithPermissionsFilter: AuthWithPermissionFunc = (permissionsFunc) => ({
    filter: (user) => user.permissions.admin || permissionsFunc(user.permissions)
        ? ADMIN_FILTER
        : NO_DATA_FILTER
})

export const CrudAuthReadOnlyWithPermissionFunc: AuthWithPermissionFunc = (permissionsFunc) => ({
    persist: (user) => user.permissions.admin || permissionsFunc(user.permissions)
        ? ADMIN_FILTER
        : READ_ONLY_FILTER
})

export const CrudAuthCustomFilter: AuthWithFilterFunc = (buildFilterFunc) => ({
    filter: (user) => user.permissions.admin
        ? ADMIN_FILTER
        : buildFilterFunc(user)
})
