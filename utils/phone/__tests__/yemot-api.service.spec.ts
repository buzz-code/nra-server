import { of, throwError } from "rxjs";
import { YemotApiService } from "../yemot-api.service";

describe("YemotApiService", () => {
    let service: YemotApiService;
    let mockHttpService: any;

    beforeEach(() => {
        mockHttpService = {
            post: jest.fn(),
            get: jest.fn(),
        };
        service = new YemotApiService(mockHttpService);
    });

    describe("createTemplate", () => {
        it("should call the correct endpoint and return response data", async () => {
            const mockResponse = { responseStatus: "OK", template: "tpl_123" };
            mockHttpService.post.mockReturnValue(of({ data: mockResponse }));

            const result = await service.createTemplate("api-key", "My Template");

            expect(mockHttpService.post).toHaveBeenCalledWith(
                expect.stringContaining("/CreateTemplate"),
                {},
                expect.objectContaining({
                    headers: { authorization: "api-key" },
                    params: { description: "My Template" },
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it("should throw a wrapped error when the HTTP call fails", async () => {
            mockHttpService.post.mockReturnValue(throwError(() => new Error("Network error")));

            await expect(service.createTemplate("api-key", "desc")).rejects.toThrow(
                "Yemot API error: Network error"
            );
        });
    });

    describe("uploadPhoneList", () => {
        it("should format phone entries as 'phone:name' and upload them", async () => {
            const mockResponse = { responseStatus: "OK" };
            mockHttpService.post.mockReturnValue(of({ data: mockResponse }));

            await service.uploadPhoneList("api-key", "tpl_123", [
                { phone: "0521234567", name: "Alice" },
                { phone: "0529876543" },
            ]);

            expect(mockHttpService.post).toHaveBeenCalledWith(
                expect.stringContaining("/UploadPhoneList"),
                {},
                expect.objectContaining({
                    params: expect.objectContaining({
                        template: "tpl_123",
                        phones: "0521234567:Alice,0529876543",
                    }),
                })
            );
        });

        it("should throw a wrapped error when the HTTP call fails", async () => {
            mockHttpService.post.mockReturnValue(throwError(() => new Error("Timeout")));

            await expect(service.uploadPhoneList("key", "tpl", [])).rejects.toThrow(
                "Yemot API error: Timeout"
            );
        });
    });

    describe("runCampaign", () => {
        it("should call RunCampaign with TTS params", async () => {
            const mockResponse = { responseStatus: "OK", id: "camp_456" };
            mockHttpService.post.mockReturnValue(of({ data: mockResponse }));

            const result = await service.runCampaign("api-key", "tpl_123", {
                ttsText: "Hello world",
                callerId: "035586526",
            });

            expect(mockHttpService.post).toHaveBeenCalledWith(
                expect.stringContaining("/RunCampaign"),
                {},
                expect.objectContaining({
                    params: expect.objectContaining({
                        template: "tpl_123",
                        ttsMode: 1,
                        ttsText: "Hello world",
                        callerId: "035586526",
                    }),
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it("should not include callerId when not provided", async () => {
            mockHttpService.post.mockReturnValue(of({ data: { responseStatus: "OK", id: "c1" } }));

            await service.runCampaign("key", "tpl", { ttsText: "Hi" });

            const call = mockHttpService.post.mock.calls[0];
            expect(call[2].params).not.toHaveProperty("callerId");
        });

        it("should throw a wrapped error when the HTTP call fails", async () => {
            mockHttpService.post.mockReturnValue(throwError(() => new Error("Auth failed")));

            await expect(
                service.runCampaign("key", "tpl", { ttsText: "Hi" })
            ).rejects.toThrow("Yemot API error: Auth failed");
        });
    });

    describe("getCampaignStatus", () => {
        it("should call GetCampaignStatus with the campaign ID and return status", async () => {
            const mockStatus = {
                responseStatus: "OK",
                calls: 100,
                answered: 80,
                notAnswered: 15,
                failed: 5,
                status: "completed",
            };
            mockHttpService.get.mockReturnValue(of({ data: mockStatus }));

            const result = await service.getCampaignStatus("api-key", "camp_456");

            expect(mockHttpService.get).toHaveBeenCalledWith(
                expect.stringContaining("/GetCampaignStatus"),
                expect.objectContaining({
                    headers: { authorization: "api-key" },
                    params: { campaignId: "camp_456" },
                })
            );
            expect(result).toEqual(mockStatus);
        });

        it("should throw a wrapped error when the HTTP call fails", async () => {
            mockHttpService.get.mockReturnValue(throwError(() => new Error("503")));

            await expect(service.getCampaignStatus("key", "c1")).rejects.toThrow(
                "Yemot API error: 503"
            );
        });
    });

    describe("uploadFile", () => {
        it("should post a multipart form with token, path and file, and return response data", async () => {
            const mockResponse = { responseStatus: "OK" };
            mockHttpService.post.mockReturnValue(of({ data: mockResponse }));

            const fileBuffer = Buffer.from("audio-bytes");
            const result = await service.uploadFile("api-key", "ivr/1/5/000.wav", fileBuffer, "000.wav");

            expect(mockHttpService.post).toHaveBeenCalledWith(
                expect.stringContaining("/UploadFile"),
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.any(Object),
                })
            );
            const postedFormData = mockHttpService.post.mock.calls[0][1];
            expect(typeof postedFormData.getHeaders).toBe("function");
            expect(result).toEqual(mockResponse);
        });

        it("should throw a wrapped error when the HTTP call fails", async () => {
            mockHttpService.post.mockReturnValue(throwError(() => new Error("Upload failed")));

            await expect(
                service.uploadFile("api-key", "ivr/1", Buffer.from("x"), "x.wav")
            ).rejects.toThrow("Yemot API error: Upload failed");
        });
    });

    describe("downloadFile", () => {
        it("should get the file from the correct endpoint and return a Buffer", async () => {
            const fileBuffer = Buffer.from("audio-bytes");
            mockHttpService.get.mockReturnValue(of({ data: fileBuffer }));

            const result = await service.downloadFile("api-key", "ivr/1/5/000.wav");

            expect(mockHttpService.get).toHaveBeenCalledWith(
                expect.stringContaining("/GetFile"),
                expect.objectContaining({
                    headers: { authorization: "api-key" },
                    params: { path: "ivr/1/5/000.wav" },
                    responseType: "arraybuffer",
                })
            );
            expect(Buffer.isBuffer(result)).toBe(true);
            expect(result.equals(fileBuffer)).toBe(true);
        });

        it("should throw a wrapped error when the HTTP call fails", async () => {
            mockHttpService.get.mockReturnValue(throwError(() => new Error("Not found")));

            await expect(service.downloadFile("api-key", "ivr/1")).rejects.toThrow(
                "Yemot API error: Not found"
            );
        });
    });
});
