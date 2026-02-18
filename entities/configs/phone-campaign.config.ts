import { CrudAuthWithPermissionsFilter } from "@shared/auth/crud-auth.filter";
import { BaseEntityModuleOptions, Entity } from "@shared/base-entity/interface";
import { IHeader } from "@shared/utils/exporter/types";
import { PhoneCampaign } from "@shared/entities/PhoneCampaign.entity";
import { PhoneTemplate } from "@shared/entities/PhoneTemplate.entity";
import { BaseEntityService } from "@shared/base-entity/base-entity.service";
import { CrudRequest } from "@dataui/crud";
import { Logger, BadRequestException, UnauthorizedException, NotFoundException } from "@nestjs/common";
import axios from 'axios';

const MAX_RECIPIENTS_PER_CAMPAIGN = 1000;
const API_TIMEOUT_MS = 30000;
const YEMOT_API_URL = 'https://www.call2all.co.il/ym/api/MakeCall';

interface CallResult {
  recipientId: number;
  recipientName: string;
  phone: string | null;
  success: boolean;
  result?: any;
  error?: string;
}

class PhoneCampaignService<T extends Entity | PhoneCampaign> extends BaseEntityService<T> {
  private readonly logger = new Logger(PhoneCampaignService.name);

  async doAction(req: CrudRequest<any, any>, body: any): Promise<any> {
    const { action } = req.parsed.extra;

    if (action === 'executeFromBulk') {
      return this.executeFromBulk(body, req.auth);
    }

    if (action === 'testCall') {
      return this.testCall(body, req.auth);
    }

    return super.doAction(req, body);
  }

  /**
   * Execute campaign directly from bulk selection (create + execute in one action)
   */
  private async executeFromBulk(body: any, auth: any): Promise<any> {
    const { templateId, recipientIds } = body;

    // Validation
    this.validateCampaignInput(templateId, recipientIds, auth);

    // Get and validate template
    const template = await this.getAndValidateTemplate(templateId, auth);

    // Get API key
    const apiKey = this.getApiKey(auth);

    // Create campaign record
    const campaignRepo = this.dataSource.getRepository(PhoneCampaign);
    const campaign = campaignRepo.create({
      userId: auth.userId,
      templateId,
      recipientIds,
      status: 'in_progress'
    });
    await campaignRepo.save(campaign);

    // Execute immediately
    try {
      const results = await this.executeCalls(recipientIds, template.message, apiKey);

      campaign.results = results;
      campaign.status = 'completed';
      await campaignRepo.save(campaign);

      const successCount = results.filter(r => r.success).length;
      return { message: `הקמפיין הושלם. ${successCount}/${results.length} שיחות הצליחו` };
    } catch (error) {
      campaign.status = 'failed';
      campaign.errorMessage = error.message;
      await campaignRepo.save(campaign);
      throw error;
    }
  }

  /**
   * Test a template with a single call
   */
  private async testCall(body: any, auth: any): Promise<string> {
    const { templateId, phone } = body;

    if (!templateId || !phone) {
      throw new BadRequestException('חסרים פרטים נדרשים');
    }

    const template = await this.getAndValidateTemplate(templateId, auth);
    const apiKey = this.getApiKey(auth);

    await this.makeCall(apiKey, phone, template.message);
    return 'שיחת מבחן נשלחה בהצלחה';
  }

  /**
   * Execute calls to all recipients
   */
  private async executeCalls(recipientIds: number[], message: string, apiKey: string): Promise<CallResult[]> {
    const recipients = await this.dataSource
      .getRepository('Student')
      .createQueryBuilder('student')
      .where('student.id IN (:...ids)', { ids: recipientIds })
      .select(['student.id', 'student.phone', 'student.name'])
      .getMany();

    if (recipients.length === 0) {
      throw new BadRequestException('לא נמצאו נמענים תקינים');
    }

    const results: CallResult[] = [];

    for (const recipient of recipients) {
      if (!recipient.phone) {
        results.push({
          recipientId: recipient.id,
          recipientName: recipient.name,
          phone: null,
          success: false,
          error: 'חסר מספר טלפון'
        });
        continue;
      }

      try {
        const result = await this.makeCall(apiKey, recipient.phone, message);
        results.push({
          recipientId: recipient.id,
          recipientName: recipient.name,
          phone: recipient.phone,
          success: true,
          result
        });
        this.logger.log(`Call successful for recipient ${recipient.id}`);
      } catch (error) {
        results.push({
          recipientId: recipient.id,
          recipientName: recipient.name,
          phone: recipient.phone,
          success: false,
          error: error.message
        });
        this.logger.error(`Call failed for recipient ${recipient.id}: ${error.message}`);
      }

      // Small delay between calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Make a call using Yemot API
   */
  private async makeCall(apiKey: string, phone: string, message: string): Promise<any> {
    try {
      const response = await axios.post(
        YEMOT_API_URL,
        { token: apiKey, phone, text: message },
        { timeout: API_TIMEOUT_MS }
      );

      if (response.data?.status === 'error' || response.data?.error) {
        throw new Error(response.data.message || response.data.error || 'שגיאה ב-API');
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('זמן תגובה חרג - נסה שוב מאוחר יותר');
        }
        if (error.response) {
          throw new Error(`שגיאת API: ${error.response.status}`);
        }
        if (error.request) {
          throw new Error('אין חיבור לשרת');
        }
      }
      throw error;
    }
  }

  /**
   * Validate campaign input parameters
   */
  private validateCampaignInput(templateId: any, recipientIds: any, auth: any): void {
    if (!templateId) {
      throw new BadRequestException('חסרה תבנית');
    }

    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      throw new BadRequestException('חסרים נמענים');
    }

    if (recipientIds.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
      throw new BadRequestException(`מקסימום ${MAX_RECIPIENTS_PER_CAMPAIGN} נמענים בקמפיין`);
    }

    if (!auth?.userId) {
      throw new UnauthorizedException('משתמש לא מאומת');
    }
  }

  /**
   * Get template and validate ownership
   */
  private async getAndValidateTemplate(templateId: number, auth: any): Promise<PhoneTemplate> {
    const templateRepo = this.dataSource.getRepository(PhoneTemplate);
    const template = await templateRepo.findOne({ where: { id: templateId } });

    if (!template) {
      throw new NotFoundException('תבנית לא נמצאה');
    }

    if (template.userId !== auth.userId) {
      throw new UnauthorizedException('אין הרשאה לתבנית זו');
    }

    return template;
  }

  /**
   * Get and validate API key from user
   */
  private getApiKey(auth: any): string {
    const apiKey = auth.user?.additionalData?.yemotApiKey;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new BadRequestException('מפתח API לא מוגדר בהגדרות');
    }

    return apiKey.trim();
  }
}

function getConfig(): BaseEntityModuleOptions {
  return {
    entity: PhoneCampaign,
    crudAuth: CrudAuthWithPermissionsFilter(permissions => permissions.phoneCampaign),
    service: PhoneCampaignService,
    exporter: {
      getExportHeaders(): IHeader[] {
        return [
          { value: 'id', label: 'מזהה' },
          { value: 'template.name', label: 'תבנית' },
          { value: 'status', label: 'סטטוס' },
          { value: 'createdAt', label: 'תאריך יצירה' },
        ];
      }
    },
  };
}

export default getConfig();
