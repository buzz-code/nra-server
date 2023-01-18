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