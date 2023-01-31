import { AuthOptions, CrudRequest, QueryOptions } from "@dataui/crud";
import { EntityClassOrSchema } from "@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type";
import { User } from "@shared/entities/User.entity";
import { IHeader } from "@shared/exporter/types";

export interface IHasUserId {
    userId: number;
}

export type EntityType = EntityClassOrSchema;
export type Entity = IHasUserId | User;

export interface BaseEntityModuleOptions {
    entity: EntityType;
    query?: QueryOptions;
    crudAuth?: AuthOptions;
    exporter?: ExportDefinition;
}

export interface ExportDefinition {
    processReqForExport?(req: CrudRequest, innerFunc: (req: CrudRequest) => Promise<any>): Promise<any[]>;
    getExportHeaders?(entityColumns: string[]): IHeader[];
}
