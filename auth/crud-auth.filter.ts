export const CrudAuthFilter = {
    property: 'user',
    filter: (user) => user.permissions.admin
        ? ({})
        : ({
            userId: user.effective_id,
        })
};

export const CrudAuthAdminFilter = {
    property: 'user',
    filter: (user) => user.permissions.admin
        ? ({})
        : ({ id: -1 })
}