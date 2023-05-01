export const CrudAuthFilter = {
    filter: (user) => user.permissions.admin
        ? ({})
        : ({
            userId: user.effective_id || user.id,
        })
};

export const CrudAuthAdminFilter = {
    filter: (user) => user.permissions.admin
        ? ({})
        : ({ id: -1 })
}

export const CrudAuthWithPermissionsFilter = (permissionsFunc: (permissions: any) => boolean) => ({
    filter: (user) => user.permissions.admin || permissionsFunc(user.permissions)
        ? ({})
        : ({ id: -1 })
})
