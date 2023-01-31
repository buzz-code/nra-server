import { Controller, DynamicModule, Get, Inject, Injectable, Module, UseGuards, UseInterceptors } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Crud, CrudAuth, CrudRequest, CrudRequestInterceptor, ParsedRequest } from '@dataui/crud';
import { CrudAuthFilter } from '@shared/auth/crud-auth.filter';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { ExportFormats } from '@shared/exporter/types';
import { snakeCase } from 'change-case';
import { BaseEntityController } from './base-entity.controller';
import { BaseEntityService } from './base-entity.service';
import { BaseEntityModuleOptions, Entity } from './interface';

@Module({})
export class BaseEntityModule {
    static register(options: BaseEntityModuleOptions): DynamicModule {
        const entityName = 'name' in options.entity ? options.entity.name : options.entity.options.name;

        @Injectable()
        class EntityService extends BaseEntityService<Entity> {
            constructor(@InjectRepository(options.entity) repo) {
                super(repo, options.exporter);
            }
        }


        @Crud({
            model: {
                type: options.entity,
            },
            query: options.query,
        })
        @UseGuards(JwtAuthGuard)
        @CrudAuth(options.crudAuth ?? CrudAuthFilter)
        @Controller(snakeCase(entityName))
        class EntityController extends BaseEntityController<Entity> {
            constructor(public service: EntityService) {
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
        }


        return {
            module: BaseEntityModule,
            imports: [TypeOrmModule.forFeature([options.entity])],
            providers: [
                EntityService,
            ],
            exports: [EntityService],
            controllers: [EntityController],
        };
    }
}
