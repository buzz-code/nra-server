import { CrudController, CrudRequest, CrudValidationGroups } from "@dataui/crud";
import { getExportedFile } from "@shared/utils/exporter/exporter.util";
import { BaseEntityService } from "./base-entity.service";
import { Entity } from "./interface";
import { parseExcelFile } from "@shared/utils/importer/importer.util";
import { defaultReqObject } from "@shared/utils/importer/types";
import { ImportFile, ImportFileSource } from "@shared/entities/ImportFile.entity";
import { RecievedMail } from "@shared/entities/RecievedMail.entity";
import { MailData } from "@shared/utils/mail/interface";
import { MailAddress } from "@shared/entities/MailAddress.entity";
import { CommonFileResponse, exportFormatDict } from "@shared/utils/report/types";
import { generateCommonFileResponse } from "@shared/utils/report/report.util";
import { plainToInstance, Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, validate, ValidateNested } from "class-validator";

export class BaseEntityController<T extends Entity> implements CrudController<T> {
    constructor(
        public service: BaseEntityService<T>,
        private model: any
    ) { }

    getCount(req: CrudRequest) {
        return this.service.getCount(req);
    }

    protected async exportFile(req: CrudRequest<any, any>): Promise<CommonFileResponse> {
        const data = await this.service.getDataForExport(req);
        const format = exportFormatDict[req.parsed.extra.format];
        return getExportedFile(format, this.service.getName(), data, this.service.getExportHeaders());
    }

    protected async getUserIdFromMailAddress(mailAddress: string) {
        const alias = mailAddress.split('@')[0];
        const mailAddressRepo = this.service.getEntityManager()
            .getRepository(MailAddress);
        const matchingRecord = await mailAddressRepo.findOneByOrFail({ alias });
        return matchingRecord.userId;
    }

    protected async importExcelFile(userId: number, fileBase64: string, fileName: string, fileSource: ImportFileSource): Promise<ImportFile> {
        let created: any[] = [];
        let response: string = null;
        try {
            const bulk = await parseExcelFile(fileBase64, this.service.getImportFields());
            bulk.forEach(item => item.userId ??= userId);
            await validateBulk<T>(bulk, this.model);
            created = await this.service.createMany(defaultReqObject, { bulk });
            response = `${created.length} רשומות נשמרו בהצלחה`;
        } catch (e) {
            response = 'לא נשמר, ארעה שגיאה ' + e.message;
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
        const { generator, params } = await this.service.getReportData(req);
        return generateCommonFileResponse(generator, params, this.service.dataSource);
    }

    protected async doAction(req: CrudRequest): Promise<any> {
        return this.service.doAction(req);
    }

    protected async getPivotData(req: CrudRequest) {
        return this.service.getPivotData(req);
    }
}

async function validateBulk<T extends Entity>(bulk: any[], model: any) {
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
