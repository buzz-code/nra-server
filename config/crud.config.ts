import { CrudConfigService } from '@nestjsx/crud';

CrudConfigService.load({
    auth: {
        property: 'user'
    },
    routes: {
        exclude: []
    },
    //   query: {
    //     limit: 25,
    //     cache: 2000,
    //   },
    // params: {
    //     id: {
    //         field: 'id',
    //         type: 'number',
    //         primary: true,
    //     },
    // },
    //   routes: {
    //     updateOneBase: {
    //       allowParamsOverride: true,
    //     },
    //     deleteOneBase: {
    //       returnDeleted: true,
    //     },
    //   },
});

export const CrudConfig = {};