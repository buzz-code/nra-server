import { Injectable } from "@nestjs/common";
import { CrudRequest } from "@dataui/crud";
import { DeepPartial, Repository } from "typeorm";
import { BaseEntityModuleOptions, InjectEntityRepository } from "@shared/base-entity/interface";
import { BaseEntityService } from "@shared/base-entity/base-entity.service";
import { CrudAuthFilter } from "@shared/auth/crud-auth.filter";
import { PhoneTemplate } from "@shared/entities/PhoneTemplate.entity";
import { YemotApiService } from "@shared/utils/phone/yemot-api.service";
import { MailSendService } from "@shared/utils/mail/mail-send.service";
import { User } from "@shared/entities/User.entity";
import { getUserIdFromUser } from "@shared/auth/auth.util";

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
                const { templateId, phoneNumber } = body;
                if (!templateId || !phoneNumber) {
                    return { error: "Missing templateId or phoneNumber" };
                }
                const userId = getUserIdFromUser(req.auth);
                const template = await this.repo.findOne({ where: { id: templateId, userId } });
                if (!template) {
                    return { error: "Template not found" };
                }
                const apiKey = await this.getUserYemotApiKey(req.auth?.id);
                if (!apiKey) {
                    return { error: "Yemot API key not configured" };
                }
                try {
                    await this.yemotApiService.uploadPhoneList(apiKey, template.yemotTemplateId, [{ phone: phoneNumber }]);
                    const result = await this.yemotApiService.runCampaign(apiKey, template.yemotTemplateId, {
                        ttsText: template.messageText,
                        callerId: template.callerId,
                    });
                    return { success: true, message: "Test call initiated", campaignId: result.id };
                } catch (error) {
                    return { error: error.message };
                }
            }
        }
        return super.doAction(req, body);
    }

    async createOne(req: CrudRequest, dto: DeepPartial<PhoneTemplate>): Promise<PhoneTemplate> {
        const apiKey = await this.getUserYemotApiKey(req.auth?.id);
        if (!apiKey) {
            throw new Error("Yemot API key not configured in user settings");
        }
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
        crudAuth: CrudAuthFilter,
    };
}

export default getConfig();
