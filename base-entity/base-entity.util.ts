import { CrudValidationGroups } from "@dataui/crud";
import { Address } from "@nestjs-modules/mailer/dist/interfaces/send-mail-options.interface";
import { BadRequestException } from "@nestjs/common";
import { getUserIdFromUser } from "@shared/auth/auth.util";
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

export async function validateUserHasPaid(auth: any, dataSource: DataSource, message = 'פעולה זו דורשת תשלום') {
    if (auth.permissions.admin) {
        return;
    }

    const userInfo = await dataSource.getRepository(User)
        .findOne({ where: { id: getUserIdFromUser(auth) }, select: { isPaid: true } });
    if (!userInfo.isPaid) {
        throw new BadRequestException(message);
    }
}

export async function validateUserHasPaidOrValidTrial(auth: any, dataSource: DataSource, message = 'פעולה זו דורשת תשלום') {
    if (auth.permissions.admin) {
        return;
    }

    const userInfo = await dataSource.getRepository(User)
        .findOne({ where: { id: getUserIdFromUser(auth) }, select: { isPaid: true, additionalData: true } });
    if (!userInfo.isPaid) {
        if (userInfo.additionalData?.trialEndDate && new Date(userInfo.additionalData.trialEndDate) < new Date()) {
            throw new BadRequestException(message);
        }
    }
}

export async function getUserMailAddressFrom(auth: any, dataSource: DataSource, domain = 'mail.yoman.online'): Promise<Address> {
    if (auth.permissions.admin) {
        return {
            name: 'מערכת יומן',
            address: 'test@' + domain,
        };
    }

    const userData = await dataSource.getRepository(User)
        .findOne({ where: { id: getUserIdFromUser(auth) }, select: { mailAddressAlias: true, mailAddressTitle: true } });
    if (!userData?.mailAddressAlias || !userData?.mailAddressTitle) {
        return {
            name: 'יש להגדיר שם',
            address: 'test@' + domain,
        };
    }

    return {
        name: userData.mailAddressTitle,
        address: userData.mailAddressAlias + '@' + domain,
    };
}
