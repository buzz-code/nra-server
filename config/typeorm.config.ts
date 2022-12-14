import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { databaseConfig } from "./database.config";

export const typeOrmModuleConfig: TypeOrmModuleOptions = {
    ...databaseConfig,
    autoLoadEntities: true,
}
