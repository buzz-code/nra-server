import { Injectable } from "@nestjs/common";
import { CrudRequest } from "@dataui/crud";
import { Repository } from "typeorm";
import { BaseEntityModuleOptions, InjectEntityRepository } from "@shared/base-entity/interface";
import { BaseEntityService } from "@shared/base-entity/base-entity.service";
import { CrudAuthWithPermissionsFilter } from "@shared/auth/crud-auth.filter";
import { PhoneCampaign, PhoneEntry } from "@shared/entities/PhoneCampaign.entity";
import { PhoneTemplate } from "@shared/entities/PhoneTemplate.entity";
import { YemotApiService } from "@shared/utils/phone/yemot-api.service";
import { MailSendService } from "@shared/utils/mail/mail-send.service";
import { User } from "@shared/entities/User.entity";
import { getUserIdFromUser } from "@shared/auth/auth.util";
import { getAsNumberArray, getAsNumber } from "@shared/utils/queryParam.util";

@Injectable()
export class PhoneCampaignService extends BaseEntityService<PhoneCampaign> {
    constructor(
        @InjectEntityRepository repo: Repository<PhoneCampaign>,
        mailSendService: MailSendService,
        private readonly yemotApiService: YemotApiService
    ) {
        super(repo, mailSendService);
    }

    async doAction(req: CrudRequest<any, any>, body: any): Promise<any> {
        switch (req.parsed.extra.action) {
            case "refresh-status": {
                const ids = getAsNumberArray(req.parsed.extra.ids) ?? [];
                const userId = getUserIdFromUser(req.auth);
                const results = await Promise.all(ids.map(id => this.refreshCampaignStatus(id, userId)));
                return { results };
            }
            case "execute-phone-campaign": {
                const templateId = getAsNumber(req.parsed.extra.templateId);
                if (!templateId) {
                    throw new Error("Invalid templateId");
                }
                const phoneNumbers = req.parsed.extra.phoneNumbers ?? [];
                return this.executeCampaign(getUserIdFromUser(req.auth), templateId, phoneNumbers);
            }
        }
        return super.doAction(req, body);
    }

    /**
     * Execute a phone campaign for a list of phone numbers.
     */
    async executeCampaign(
        userId: number,
        templateId: number,
        phoneNumbers: PhoneEntry[]
    ): Promise<any> {
        const template = await this.validateTemplate(templateId, userId);
        const apiKey = await this.validateYemotApiKey(userId);
        
        const campaign = this.repo.create({
            userId,
            phoneTemplateId: templateId,
            status: "pending",
            totalPhones: phoneNumbers.length,
            phoneNumbers,
            successfulCalls: 0,
            failedCalls: 0,
        });
        await this.repo.save(campaign);
        
        try {
            await this.runYemotCampaign(campaign, template, apiKey, phoneNumbers);
            return {
                success: true,
                campaignId: campaign.id,
                yemotCampaignId: campaign.yemotCampaignId,
                message: `Campaign started with ${phoneNumbers.length} phone numbers`,
            };
        } catch (error) {
            campaign.status = "failed";
            campaign.errorMessage = error.message;
            await this.repo.save(campaign);
            throw error;
        }
    }

    private async validateTemplate(templateId: number, userId: number): Promise<PhoneTemplate> {
        const template = await this.dataSource.getRepository(PhoneTemplate).findOne({
            where: { id: templateId, userId },
        });
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

    private async runYemotCampaign(
        campaign: PhoneCampaign,
        template: PhoneTemplate,
        apiKey: string,
        phoneNumbers: PhoneEntry[]
    ): Promise<void> {
        if (!phoneNumbers || phoneNumbers.length === 0) {
            throw new Error("No phone numbers provided");
        }
        
        await this.yemotApiService.uploadPhoneList(apiKey, template.yemotTemplateId, phoneNumbers);
        const result = await this.yemotApiService.runCampaign(apiKey, template.yemotTemplateId, {
            ttsText: template.messageText,
            callerId: template.callerId,
        });
        
        if (result.responseStatus !== "OK" || !result.id) {
            throw new Error(`Failed to run campaign: ${result.message || "Unknown error"}`);
        }
        
        campaign.yemotCampaignId = result.id;
        campaign.status = "running";
        await this.repo.save(campaign);
    }

    /**
     * Refresh campaign status from Yemot API.
     */
    async refreshCampaignStatus(campaignId: number, userId: number): Promise<any> {
        const campaign = await this.repo.findOne({ where: { id: campaignId, userId } });
        if (!campaign) {
            return { error: "Campaign not found or access denied" };
        }
        if (!campaign.yemotCampaignId) {
            return { error: "Campaign has no Yemot ID" };
        }
        const apiKey = await this.getUserYemotApiKey(userId);
        if (!apiKey) {
            return { error: "Yemot API key not configured" };
        }
        try {
            const status = await this.yemotApiService.getCampaignStatus(apiKey, campaign.yemotCampaignId);
            if (status.calls !== undefined) campaign.totalPhones = status.calls;
            if (status.answered !== undefined) campaign.successfulCalls = status.answered;
            if (status.failed !== undefined || status.notAnswered !== undefined) {
                campaign.failedCalls = (status.failed ?? 0) + (status.notAnswered ?? 0);
            }
            if (status.status) {
                const s = status.status.toLowerCase();
                if (s.includes("complete")) {
                    campaign.status = "completed";
                    campaign.completedAt = new Date();
                } else if (s.includes("fail")) {
                    campaign.status = "failed";
                } else if (s.includes("running") || s.includes("active")) {
                    campaign.status = "running";
                }
            }
            await this.repo.save(campaign);
            return {
                success: true,
                campaign: {
                    id: campaign.id,
                    status: campaign.status,
                    totalPhones: campaign.totalPhones,
                    successfulCalls: campaign.successfulCalls,
                    failedCalls: campaign.failedCalls,
                },
            };
        } catch (error) {
            return { error: error.message };
        }
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
        entity: PhoneCampaign,
        service: PhoneCampaignService,
        providers: [YemotApiService],
        crudAuth: CrudAuthWithPermissionsFilter(permissions => permissions?.phoneCampaign),
    };
}

export default getConfig();
