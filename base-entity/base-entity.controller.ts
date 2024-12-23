import { CrudController, CrudRequest } from "@dataui/crud";
import { getExportedFile } from "@shared/utils/exporter/exporter.util";
import { BaseEntityService } from "./base-entity.service";
import { Entity } from "./interface";
import { parseExcelFileAdvanced } from "@shared/utils/importer/importer.util";
import { defaultReqObject } from "@shared/utils/importer/types";
import { ImportFile, ImportFileSource } from "@shared/entities/ImportFile.entity";
import { RecievedMail } from "@shared/entities/RecievedMail.entity";
import { MailData } from "@shared/utils/mail/interface";
import { MailAddress } from "@shared/entities/MailAddress.entity";
import { CommonFileResponse, exportFormatDict } from "@shared/utils/report/types";
import { generateCommonFileResponse } from "@shared/utils/report/report.util";
import { validateBulk, validateUserHasPaid } from "./base-entity.util";
import * as addressparser from 'addressparser';
import { User } from "@shared/entities/User.entity";
import { mailDomain } from "@shared/config/mail-workflows";

export class BaseEntityController<T extends Entity> implements CrudController<T> {
    constructor(
        public service: BaseEntityService<T>,
        private model: any
    ) { }

    private getUserById(userId: number) {
        return this.service.dataSource.getRepository(User).findOneOrFail({ where: { id: userId } });
    }

    getCount(req: CrudRequest) {
        return this.service.getCount(req);
    }

    protected async exportFile(req: CrudRequest<any, any>): Promise<CommonFileResponse> {
        await validateUserHasPaid(req.auth, this.service.dataSource);
        const data = await this.service.getDataForExport(req);
        const format = exportFormatDict[req.parsed.extra.format];
        const headers = this.service.getExportHeaders(req, data);
        const name = this.service.getName();
        return getExportedFile(format, name, data, headers);
    }

    protected async getUserIdFromMailAddress(mailAddress: string, domain = mailDomain) {
        const addresses = addressparser(mailAddress);
        const address = addresses.find(a => a.address.includes(domain));
        const alias = address.address.split('@')[0];
        const mailAddressRepo = this.service.getEntityManager()
            .getRepository(MailAddress);
        const matchingRecord = await mailAddressRepo.findOneByOrFail({ alias });
        return matchingRecord.userId;
    }

    protected async getBccAddressFromUserId(userId: number) {
        try {
            const user = await this.getUserById(userId);
            return user.bccAddress;
        } catch (e) {
            console.log('getBccAddressFromUserId error - user not found', userId);
            return null;
        }
    }

    protected async importExcelFile(userId: number, fileBase64: string, fileName: string, fileSource: ImportFileSource): Promise<ImportFile> {
        const user = await this.getUserById(userId);
        let created: any[] = [];
        let response: string = null;
        let isFullSuccess = false;
        try {
            const importDefinition = this.service.getImportDefinition();
            const bulk = await parseExcelFileAdvanced(fileBase64, importDefinition.importFields, importDefinition.specialFields ?? []);
            bulk.forEach(item => {
                item.userId ??= userId;
                importDefinition.hardCodedFields?.forEach(hcf => {
                    if (item[hcf.field] === null || item[hcf.field] === undefined || item[hcf.field] === '') {
                        item[hcf.field] = hcf.value
                    }
                });
                importDefinition.beforeSave?.(item, user);
            });
            await validateBulk<T>(bulk, this.model);
            created = await this.service.createMany(defaultReqObject, { bulk });
            isFullSuccess = created.length === bulk.length;
            response = `${created.length} רשומות נשמרו בהצלחה`;
        } catch (e) {
            response = 'לא נשמר, ארעה שגיאה: ' + e.message;
            console.log('file import error', e);
        } finally {
            const importFileRepo = this.service.getEntityManager()
                .getRepository(ImportFile);

            const importFile = importFileRepo.create({
                userId,
                fileName,
                fileSource,
                entityName: this.service.getName(),
                entityIds: created.map(item => item.id),
                fullSuccess: isFullSuccess,
                response,
            })
            await importFileRepo.save(importFile);

            return importFile;
        }
    }

    protected async saveEmailData(userId: number, mailData: MailData, importFiles: ImportFile[]) {
        const recievedMailRepo = this.service.getEntityManager()
            .getRepository(RecievedMail);
        const { attachments, ...mailMetadata } = mailData;
        const recievedMail = recievedMailRepo.create({
            userId,
            entityName: this.service.getName(),
            mailData: mailMetadata,
            importFileIds: importFiles.map(i => i.id),
            from: mailData.from,
            to: mailData.to,
            subject: mailData.subject,
            body: mailData.plain_body,
        })
        await recievedMailRepo.save(recievedMail);
    }

    protected async getReportData(req: CrudRequest): Promise<CommonFileResponse> {
        await validateUserHasPaid(req.auth, this.service.dataSource);
        const { generator, params } = await this.service.getReportData(req);
        return generateCommonFileResponse(generator, params, this.service.dataSource);
    }

    protected async doAction(req: CrudRequest, body: any): Promise<any> {
        return this.service.doAction(req, body);
    }

    protected async getPivotData(req: CrudRequest<any, any>) {
        if (req.parsed.extra?.pivot?.includes('/export?')) {
            [, req.parsed.extra.format] = req.parsed.extra.pivot.match(/extra.format=(.*)/);
            req.parsed.extra.pivot = req.parsed.extra.pivot.replace(/\/export\?extra.format=(.*)/, '?');
            return this.exportFile(req);
        }
        return this.service.getPivotData(req);
    }
}
