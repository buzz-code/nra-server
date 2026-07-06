import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import * as FormData from "form-data";

export interface YemotCreateTemplateResponse {
    responseStatus: string;
    template?: string;
    message?: string;
}

export interface YemotRunCampaignResponse {
    responseStatus: string;
    id?: string;
    message?: string;
}

export interface YemotCampaignStatus {
    responseStatus: string;
    calls?: number;
    answered?: number;
    notAnswered?: number;
    failed?: number;
    status?: string;
}

export interface YemotPhoneEntry {
    phone: string;
    name?: string;
}

@Injectable()
export class YemotApiService {
    private readonly logger = new Logger(YemotApiService.name);
    private readonly baseUrl = "https://www.call2all.co.il/ym/api";

    constructor(private readonly httpService: HttpService) {}

    /**
     * Create a new Yemot campaign template
     */
    async createTemplate(apiKey: string, description: string): Promise<YemotCreateTemplateResponse> {
        try {
            this.logger.log(`Creating Yemot template: ${description}`);
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/CreateTemplate`, {}, {
                    headers: { authorization: apiKey },
                    params: { description },
                })
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to create template: ${error.message}`, error.stack);
            throw new Error(`Yemot API error: ${error.message}`);
        }
    }

    /**
     * Upload phone list to template
     */
    async uploadPhoneList(
        apiKey: string,
        templateId: string,
        phones: YemotPhoneEntry[]
    ): Promise<any> {
        try {
            this.logger.log(`Uploading ${phones.length} phones to template ${templateId}`);
            const phoneList = phones.map(p => `${p.phone}${p.name ? ":" + p.name : ""}`).join(",");
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/UploadPhoneList`, {}, {
                    headers: { authorization: apiKey },
                    params: { template: templateId, phones: phoneList },
                })
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to upload phone list: ${error.message}`, error.stack);
            throw new Error(`Yemot API error: ${error.message}`);
        }
    }

    /**
     * Run campaign with TTS mode
     */
    async runCampaign(
        apiKey: string,
        templateId: string,
        options: { ttsText: string; callerId?: string }
    ): Promise<YemotRunCampaignResponse> {
        try {
            this.logger.log(`Running campaign for template ${templateId}`);
            const params: any = {
                template: templateId,
                ttsMode: 1,
                ttsText: options.ttsText,
            };
            if (options.callerId) {
                params.callerId = options.callerId;
            }
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/RunCampaign`, {}, {
                    headers: { authorization: apiKey },
                    params,
                })
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to run campaign: ${error.message}`, error.stack);
            throw new Error(`Yemot API error: ${error.message}`);
        }
    }

    /**
     * Get campaign status
     */
    async getCampaignStatus(apiKey: string, campaignId: string): Promise<YemotCampaignStatus> {
        try {
            this.logger.log(`Getting status for campaign ${campaignId}`);
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/GetCampaignStatus`, {
                    headers: { authorization: apiKey },
                    params: { campaignId },
                })
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to get campaign status: ${error.message}`, error.stack);
            throw new Error(`Yemot API error: ${error.message}`);
        }
    }

    /**
     * Upload a file (e.g. audio) to Yemot; Yemot auto-creates any missing folders in `path`.
     */
    async uploadFile(apiKey: string, path: string, fileBuffer: Buffer, fileName: string): Promise<any> {
        try {
            const ivrPath = this.toIvrPath(path);
            this.logger.log(`Uploading file to Yemot path: ${ivrPath}`);
            const formData = new FormData();
            formData.append("token", apiKey);
            formData.append("path", ivrPath);
            formData.append("file", fileBuffer, { filename: fileName });

            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/UploadFile`, formData, {
                    headers: formData.getHeaders(),
                })
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
            throw new Error(`Yemot API error: ${error.message}`);
        }
    }

    /**
     * Download a file from Yemot as a Buffer.
     */
    async downloadFile(apiKey: string, path: string): Promise<Buffer> {
        try {
            const ivrPath = this.toIvrPath(path);
            this.logger.log(`Downloading file from Yemot path: ${ivrPath}`);
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/DownloadFile`, {
                    params: { token: apiKey, path: ivrPath },
                    responseType: "arraybuffer",
                })
            );
            return Buffer.from(response.data);
        } catch (error) {
            this.logger.error(`Failed to download file: ${error.message}`, error.stack);
            throw new Error(`Yemot API error: ${error.message}`);
        }
    }

    /**
     * Delete a file from Yemot's IVR2 file system.
     */
    async deleteFile(apiKey: string, path: string): Promise<any> {
        try {
            const ivrPath = this.toIvrPath(path);
            this.logger.log(`Deleting Yemot file: ${ivrPath}`);
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/FileAction`, {
                    params: { token: apiKey, action: "delete", what0: ivrPath },
                })
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
            throw new Error(`Yemot API error: ${error.message}`);
        }
    }

    // Yemot's UploadFile/DownloadFile/FileAction reject bare paths ("path is invalid") - they
    // require the ivr2: scheme prefix, confirmed against the live API.
    private toIvrPath(path: string): string {
        return `ivr2:/${path}`;
    }
}
