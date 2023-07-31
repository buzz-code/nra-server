import { AuthOptions, CrudRequest, QueryOptions, RoutesOptions } from "@dataui/crud";
import { Inject } from "@nestjs/common";
import { EntityClassOrSchema } from "@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type";
import * as XLSX from 'xlsx';
import { User } from "@shared/entities/User.entity";
import { IHeader } from "@shared/utils/exporter/types";
import { Entity } from "typeorm";
import { BaseEntityService } from "./base-entity.service";

export interface IHasUserId {
    userId: number;
}

export type EntityType = EntityClassOrSchema;
export type Entity = IHasUserId | User;

export interface BaseEntityModuleOptions {
    entity: EntityType;
    query?: QueryOptions;
    routes?: RoutesOptions;
    crudAuth?: AuthOptions;
    exporter?: ExportDefinition;
    service?: typeof BaseEntityService;
}

export interface ExportDefinition {
    processReqForExport?(req: CrudRequest, innerFunc: (req: CrudRequest) => Promise<any>): Promise<any[]>;
    getExportHeaders?(entityColumns: string[]): IHeader[];
    getImportFields?(entityColumns: string[]): string[];
    getSpecialFields?(): Record<string, XLSX.CellAddress>;
}

export const ENTITY_REPOSITORY = 'entity_repository';
export const ENTITY_EXPORTER = 'entity_exporter';
export const ENTITY_SERVICE = 'entity_service';

export const InjectEntityRepository = Inject(ENTITY_REPOSITORY);
export const InjectEntityExporter = Inject(ENTITY_EXPORTER);
export const InjectEntityService     = Inject(ENTITY_SERVICE);
