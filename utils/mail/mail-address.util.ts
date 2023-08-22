import { MailAddress } from "@shared/entities/MailAddress.entity";
import { DataSource } from "typeorm";

export async function getMailAddressForEntity(userId: number, entity: string, dataSource: DataSource, domain = 'mail.yoman.online'): Promise<string> {
    const mailAddress = await dataSource
        .getRepository(MailAddress)
        .findOneBy({ userId, entity });
    return mailAddress?.alias + '@' + domain;
}
