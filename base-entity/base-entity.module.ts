import { Body, Controller, DynamicModule, Get, HttpException, HttpStatus, Module, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Crud, CrudAuth, CrudRequest, CrudRequestInterceptor, ParsedRequest } from '@dataui/crud';
import { CrudAuthFilter } from '@shared/auth/crud-auth.filter';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { snakeCase } from 'change-case';
import { BaseEntityController } from './base-entity.controller';
import { BaseEntityService } from './base-entity.service';
import { BaseEntityModuleOptions, Entity, ENTITY_EXPORTER, ENTITY_REPOSITORY, ENTITY_SERVICE, InjectEntityService } from './interface';
import { Public } from '@shared/auth/public.decorator';
import { HttpModule } from '@nestjs/axios';
import { HandleEmailBody } from '@shared/utils/mail/interface';
import { ImportFileSource } from '@shared/entities/ImportFile.entity';

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
            validation: {
                exceptionFactory(errors) {
                    if (errors[0]?.children?.flatMap(i => i.children)?.length) {
                        errors = errors[0].children.flatMap(i => i.children);
                    }
                    const errorMessages = errors.flatMap(item => item.constraints ? Object.values(item.constraints) : []);
                    return new HttpException({ message: errorMessages.join(', ') }, HttpStatus.BAD_REQUEST);
                }
            }
        })
        @UseGuards(JwtAuthGuard)
        @CrudAuth(options.crudAuth ?? CrudAuthFilter)
        @Controller(snakeCase(entityName))
        class EntityController extends BaseEntityController<Entity> {
            constructor(@InjectEntityService public service: BaseEntityService<Entity>) {
                super(service, options.entity);
            }

            @Get('/get-count')
            @UseInterceptors(CrudRequestInterceptor)
            getCount(@ParsedRequest() req: CrudRequest) {
                return super.getCount(req);
            }

            @Get('/export')
            @UseInterceptors(CrudRequestInterceptor)
            exportFile(@ParsedRequest() req: CrudRequest) {
                return super.exportFile(req);
            }

            @Get('/report')
            @UseInterceptors(CrudRequestInterceptor)
            getReportData(@ParsedRequest() req: CrudRequest) {
                return super.getReportData(req);
            }

            @Get('/action')
            @UseInterceptors(CrudRequestInterceptor)
            doAction(@ParsedRequest() req: CrudRequest) {
                return super.doAction(req);
            }

            @Get('/pivot')
            @UseInterceptors(CrudRequestInterceptor)
            getPivotData(@ParsedRequest() req: CrudRequest) {
                return super.getPivotData(req);
            }

            @Post('/handle-email')
            @Public()
            async handleEmail(@Body() body: HandleEmailBody) {
                const userId = await this.getUserIdFromMailAddress(body.mail_data.to);
                const importedFiles = [];
                for (const attachment of body.mail_data.attachments) {
                    importedFiles.push(await this.importExcelFile(userId, attachment.data, attachment.filename, ImportFileSource.Email));
                }
                await this.saveEmailData(userId, body.mail_data, importedFiles);
                await this.service.mailSendService.sendEmailImportResponse(body.mail_data, importedFiles);
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
