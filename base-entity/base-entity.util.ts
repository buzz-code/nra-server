import { CrudValidationGroups } from "@dataui/crud";
import { Address } from "@nestjs-modules/mailer/dist/interfaces/send-mail-options.interface";
import { BadRequestException } from "@nestjs/common";
import { User } from "@shared/entities/User.entity";
import { plainToInstance, Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, validate, ValidateNested } from "class-validator";
import { DataSource } from "typeorm";
import { Entity } from "./interface";

export async function validateBulk<T extends Entity>(bulk: any[], model: any) {
    class BulkDtoImpl {
        @IsArray({ always: true })
        @ArrayNotEmpty({ always: true })
        @ValidateNested({ each: true, groups: [CrudValidationGroups.CREATE] })
        @Type(() => model)
        bulk: T[];
    }
    const myDtoObject = plainToInstance(BulkDtoImpl, { bulk });
    const errors = await validate(myDtoObject, { groups: [CrudValidationGroups.CREATE] });
    const errorMessages = errors
        .flatMap(item => item.children)
        .flatMap(item => item.children)
        .flatMap(item => item.constraints as any)
        .filter(item => item)
        .flatMap(item => Object.values(item))
        .at(0);
    // .join(', ');
    if (errorMessages) {
        throw new Error(errorMessages as string);
    }
}

export async function validateUserHasPaid(auth: any, dataSource: DataSource, message = 'לא ניתן לבצע פעולה זו בחשבון חינמי') {
    if (auth.permissions.admin) {
        return;
    }

    const isUserPaid = await dataSource.getRepository(User)
        .findOne({ where: { id: auth.id }, select: { isPaid: true } });
    if (!isUserPaid.isPaid) {
        throw new BadRequestException(message);
    }
}

export async function getUserMailAddressFrom(auth: any, dataSource: DataSource, domain = 'mail.yoman.online'): Promise<Address> {
    if (auth.permissions.admin) {
        return undefined;
    }

    const userData = await dataSource.getRepository(User)
        .findOne({ where: { id: auth.id }, select: { mailAddressAlias: true, mailAddressTitle: true } });
    if (!userData.mailAddressAlias || !userData.mailAddressTitle) {
        return undefined;
    }

    return {
        name: userData.mailAddressTitle,
        address: userData.mailAddressAlias + '@' + domain,
    };
}
