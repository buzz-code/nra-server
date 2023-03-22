import { Body, Controller, DynamicModule, Get, Inject, Module, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Crud, CrudAuth, CrudRequest, CrudRequestInterceptor, ParsedRequest } from '@dataui/crud';
import { CrudAuthFilter } from '@shared/auth/crud-auth.filter';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { ExportFormats } from '@shared/utils/exporter/types';
import { snakeCase } from 'change-case';
import { BaseEntityController } from './base-entity.controller';
import { BaseEntityService } from './base-entity.service';
import { BaseEntityModuleOptions, Entity, ENTITY_EXPORTER, ENTITY_REPOSITORY, ENTITY_SERVICE, InjectEntityService } from './interface';
import { ImportFileBody } from '@shared/utils/importer/types';
import { Public } from '@shared/auth/public.decorator';
import { HttpModule } from '@nestjs/axios';

@Module({})
export class BaseEntityModule {
    static register(options: BaseEntityModuleOptions): DynamicModule {
        const entityName = 'name' in options.entity ? options.entity.name : options.entity.options.name;

        @Crud({
            model: {
                type: options.entity,
            },
            query: options.query,
            routes: options.routes,
        })
        @UseGuards(JwtAuthGuard)
        @CrudAuth(options.crudAuth ?? CrudAuthFilter)
        @Controller(snakeCase(entityName))
        class EntityController extends BaseEntityController<Entity> {
            constructor(@InjectEntityService public service: BaseEntityService<Entity>) {
                super(service);
            }

            @Get('/get-count')
            @UseInterceptors(CrudRequestInterceptor)
            getCount(@ParsedRequest() req: CrudRequest) {
                return super.getCount(req);
            }

            @Get('/export/excel')
            @UseInterceptors(CrudRequestInterceptor)
            exportExcel(@ParsedRequest() req: CrudRequest) {
                return this.exportFile(req, ExportFormats.Excel);
            }

            @Get('/export/pdf')
            @UseInterceptors(CrudRequestInterceptor)
            exportPdf(@ParsedRequest() req: CrudRequest) {
                return this.exportFile(req, ExportFormats.Pdf);
            }

            @Post('/import')
            @Public()
            importExcel(@Body() body: ImportFileBody) {
                return this.importExcelFile(body);
            }
        }


        return {
            module: BaseEntityModule,
            imports: [
                TypeOrmModule.forFeature([options.entity]),
                HttpModule,
            ],
            providers: [
                { provide: ENTITY_REPOSITORY, useExisting: getRepositoryToken(options.entity) },
                { provide: ENTITY_EXPORTER, useValue: options.exporter || null },
                { provide: ENTITY_SERVICE, useClass: options.service ?? BaseEntityService },
            ],
            controllers: [EntityController],
        };
    }
}
