import { S3FileStoreService } from "../s3-file-store.service";
import { S3Service } from "../s3.service";

describe("S3FileStoreService", () => {
    let service: S3FileStoreService;
    let mockS3Service: jest.Mocked<S3Service>;

    const originalBucket = process.env.S3_BUCKET;

    beforeEach(() => {
        process.env.S3_BUCKET = "my-bucket";
        mockS3Service = {
            uploadFile: jest.fn(),
            getFileBuffer: jest.fn(),
            deleteFile: jest.fn(),
        } as unknown as jest.Mocked<S3Service>;
        service = new S3FileStoreService(mockS3Service);
    });

    afterAll(() => {
        process.env.S3_BUCKET = originalBucket;
    });

    describe("buildKey", () => {
        it("should build a key namespaced by prefix and id with a unique suffix", () => {
            const key = service.buildKey("story-voices", 12, "mp3");

            expect(key).toMatch(/^story-voices\/story-voices-12-[0-9a-f-]+\.mp3$/);
        });
    });

    describe("upload", () => {
        it("should delegate to S3Service.uploadFile with the configured bucket", async () => {
            const body = Buffer.from("hello");

            await service.upload("story-voices/file.mp3", body, "audio/mpeg");

            expect(mockS3Service.uploadFile).toHaveBeenCalledWith(
                "my-bucket",
                "story-voices/file.mp3",
                body,
                "audio/mpeg",
            );
        });
    });

    describe("download", () => {
        it("should delegate to S3Service.getFileBuffer with the configured bucket", async () => {
            const buffer = Buffer.from("data");
            mockS3Service.getFileBuffer.mockResolvedValue(buffer);

            const result = await service.download("story-voices/file.mp3");

            expect(mockS3Service.getFileBuffer).toHaveBeenCalledWith("my-bucket", "story-voices/file.mp3");
            expect(result).toBe(buffer);
        });
    });

    describe("remove", () => {
        it("should delegate to S3Service.deleteFile with the configured bucket", async () => {
            await service.remove("story-voices/file.mp3");

            expect(mockS3Service.deleteFile).toHaveBeenCalledWith("my-bucket", "story-voices/file.mp3");
        });
    });
});
