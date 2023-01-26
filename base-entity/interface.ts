import { AuthOptions } from "@dataui/crud";
import { EntityClassOrSchema } from "@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type";
import { User } from "@shared/entities/User.entity";

export interface IHasUserId {
    userId: number;
}

export type EntityType = EntityClassOrSchema;
export type Entity = IHasUserId | User;

export interface BaseEntityModuleOptions {
    entity: EntityType,
    crudAuth?: AuthOptions,
}
