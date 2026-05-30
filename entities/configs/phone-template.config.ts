import { Injectable } from "@nestjs/common";
import { CrudRequest } from "@dataui/crud";
import { DeepPartial, Repository } from "typeorm";
import { BaseEntityModuleOptions, InjectEntityRepository } from "@shared/base-entity/interface";
import { BaseEntityService } from "@shared/base-entity/base-entity.service";
import { CrudAuthWithPermissionsFilter } from "@shared/auth/crud-auth.filter";
import { PhoneTemplate } from "@shared/entities/PhoneTemplate.entity";
import { YemotApiService } from "@shared/utils/phone/yemot-api.service";
import { MailSendService } from "@shared/utils/mail/mail-send.service";
import { User } from "@shared/entities/User.entity";
import { getUserIdFromUser } from "@shared/auth/auth.util";
import { getAsNumber } from "@shared/utils/queryParam.util";

@Injectable()
class PhoneTemplateService extends BaseEntityService<PhoneTemplate> {
    constructor(
        @InjectEntityRepository repo: Repository<PhoneTemplate>,
        mailSendService: MailSendService,
        private readonly yemotApiService: YemotApiService
    ) {
        super(repo, mailSendService);
    }

    async doAction(req: CrudRequest<any, any>, body: any): Promise<any> {
        switch (req.parsed.extra.action) {
            case "test": {
                const templateId = getAsNumber(req.parsed.extra.templateId);
                const phoneNumber = req.parsed.extra.phoneNumber;
                if (!templateId || !phoneNumber) {
                    throw new Error("Missing templateId or phoneNumber");
                }
                return this.sendTestCall(getUserIdFromUser(req.auth), templateId, phoneNumber);
            }
        }
        return super.doAction(req, body);
    }

    private async sendTestCall(userId: number, templateId: number, phoneNumber: string): Promise<any> {
        const template = await this.validateTemplate(templateId, userId);
        const apiKey = await this.validateYemotApiKey(userId);
        
        await this.yemotApiService.uploadPhoneList(apiKey, template.yemotTemplateId, [{ phone: phoneNumber }]);
        const result = await this.yemotApiService.runCampaign(apiKey, template.yemotTemplateId, {
            ttsText: template.messageText,
            callerId: template.callerId,
        });
        return { success: true, message: "Test call initiated", campaignId: result.id };
    }

    private async validateTemplate(templateId: number, userId: number): Promise<PhoneTemplate> {
        const template = await this.repo.findOne({ where: { id: templateId, userId } });
        if (!template) {
            throw new Error("Template not found or access denied");
        }
        if (!template.isActive) {
            throw new Error("Template is not active");
        }
        return template;
    }

    private async validateYemotApiKey(userId: number): Promise<string> {
        const apiKey = await this.getUserYemotApiKey(userId);
        if (!apiKey) {
            throw new Error("Yemot API key not configured");
        }
        return apiKey;
    }

    async createOne(req: CrudRequest, dto: DeepPartial<PhoneTemplate>): Promise<PhoneTemplate> {
        const userId = getUserIdFromUser(req.auth);
        const apiKey = await this.validateYemotApiKey(userId);
        const yemotResponse = await this.yemotApiService.createTemplate(
            apiKey,
            (dto as PhoneTemplate).description || (dto as PhoneTemplate).name
        );
        if (yemotResponse.responseStatus !== "OK" || !yemotResponse.template) {
            throw new Error(`Failed to create Yemot template: ${yemotResponse.message || "Unknown error"}`);
        }
        (dto as PhoneTemplate).yemotTemplateId = yemotResponse.template;
        return super.createOne(req, dto);
    }

    private async getUserYemotApiKey(userId: number): Promise<string | null> {
        const user = await this.dataSource.getRepository(User).findOne({
            where: { id: userId },
            select: ["id", "additionalData"],
        });
        return user?.additionalData?.yemotApiKey ?? null;
    }
}

function getConfig(): BaseEntityModuleOptions {
    return {
        entity: PhoneTemplate,
        service: PhoneTemplateService,
        providers: [YemotApiService],
    };
}

export default getConfig();
