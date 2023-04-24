export const CrudAuthFilter = {
    property: 'user',
    filter: (user) => user.permissions.admin
        ? ({})
        : ({
            userId: user.effective_id || user.id,
        })
};

export const CrudAuthAdminFilter = {
    property: 'user',
    filter: (user) => user.permissions.admin
        ? ({})
        : ({ id: -1 })
}

export const CrudAuthWithPermissionsFilter = (permissionsFunc: (permissions: any) => boolean) => ({
    property: 'user',
    filter: (user) => user.permissions.admin || permissionsFunc(user.permissions)
        ? ({})
        : ({ id: -1 })
})
