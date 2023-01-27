import { AuthOptions, CrudRequest } from "@dataui/crud";
import { EntityClassOrSchema } from "@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type";
import { User } from "@shared/entities/User.entity";
import { IHeader } from "@shared/exporter/types";

export interface IHasUserId {
    userId: number;
}

export type EntityType = EntityClassOrSchema;
export type Entity = IHasUserId | User;

export interface BaseEntityModuleOptions {
    entity: EntityType,
    crudAuth?: AuthOptions,
    exporter?: ExportDefinition,
}

export interface ExportDefinition {
    processReqForExport?(req: CrudRequest): Promise<void>;
    getExportHeaders(): IHeader[];
}
