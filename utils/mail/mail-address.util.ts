import { mailDomain } from "@shared/config/mail-workflows";
import { MailAddress } from "@shared/entities/MailAddress.entity";
import { DataSource } from "typeorm";

export async function getMailAddressForEntity(userId: number, entity: string, dataSource: DataSource, domain = mailDomain): Promise<string> {
    const mailAddress = await dataSource
        .getRepository(MailAddress)
        .findOneBy({ userId, entity });
    if (!mailAddress) return;
    return mailAddress?.alias + '@' + domain;
}
