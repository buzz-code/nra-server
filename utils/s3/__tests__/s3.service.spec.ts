import { Readable } from "stream";
import { S3Service } from "../s3.service";

describe("S3Service", () => {
    let service: S3Service;
    let mockS3Client: any;

    beforeEach(() => {
        mockS3Client = {
            send: jest.fn(),
        };
        service = new S3Service(mockS3Client);
    });

    describe("uploadFile", () => {
        it("should send a PutObjectCommand with the correct params", async () => {
            mockS3Client.send.mockResolvedValue({});
            const body = Buffer.from("hello world");

            await service.uploadFile("my-bucket", "path/to/file.txt", body, "text/plain");

            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: {
                        Bucket: "my-bucket",
                        Key: "path/to/file.txt",
                        Body: body,
                        ContentType: "text/plain",
                    },
                })
            );
        });

        it("should throw a wrapped error when the upload fails", async () => {
            mockS3Client.send.mockRejectedValue(new Error("Network error"));

            await expect(
                service.uploadFile("my-bucket", "path/to/file.txt", Buffer.from("data"))
            ).rejects.toThrow("S3 error: Network error");
        });
    });

    describe("getFileStream", () => {
        it("should send a GetObjectCommand and return the response body", async () => {
            const bodyStream = Readable.from([Buffer.from("chunk")]);
            mockS3Client.send.mockResolvedValue({ Body: bodyStream });

            const result = await service.getFileStream("my-bucket", "path/to/file.txt");

            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: { Bucket: "my-bucket", Key: "path/to/file.txt" },
                })
            );
            expect(result).toBe(bodyStream);
        });

        it("should throw a wrapped error when the fetch fails", async () => {
            mockS3Client.send.mockRejectedValue(new Error("Not found"));

            await expect(service.getFileStream("my-bucket", "missing.txt")).rejects.toThrow(
                "S3 error: Not found"
            );
        });
    });

    describe("getFileBuffer", () => {
        it("should resolve to the concatenated buffer across multiple chunks", async () => {
            const bodyStream = Readable.from([Buffer.from("hello "), Buffer.from("world")]);
            mockS3Client.send.mockResolvedValue({ Body: bodyStream });

            const result = await service.getFileBuffer("my-bucket", "path/to/file.txt");

            expect(result).toEqual(Buffer.from("hello world"));
        });

        it("should throw a wrapped error when the stream emits an error", async () => {
            const bodyStream = new Readable({
                read() {
                    this.emit("error", new Error("Stream broke"));
                },
            });
            mockS3Client.send.mockResolvedValue({ Body: bodyStream });

            await expect(service.getFileBuffer("my-bucket", "path/to/file.txt")).rejects.toThrow(
                "S3 error: Stream broke"
            );
        });

        it("should throw a wrapped error when the underlying send call fails", async () => {
            mockS3Client.send.mockRejectedValue(new Error("Timeout"));

            await expect(service.getFileBuffer("my-bucket", "path/to/file.txt")).rejects.toThrow(
                "S3 error: Timeout"
            );
        });
    });

    describe("missing keys", () => {
        const missing = () => Object.assign(new Error("Key not found"), { name: "NoSuchKey" });

        it("still throws the wrapped error but logs a warning, not an error", async () => {
            mockS3Client.send.mockRejectedValue(missing());
            const errorLog = jest.spyOn((service as any).logger, "error").mockImplementation();
            const warnLog = jest.spyOn((service as any).logger, "warn").mockImplementation();

            await expect(service.getFileBuffer("my-bucket", "a/voice.json")).rejects.toThrow(
                "S3 error: Key not found"
            );
            expect(errorLog).not.toHaveBeenCalled();
            expect(warnLog).toHaveBeenCalledWith("File not found my-bucket/a/voice.json");
        });

        it("treats a 404 response the same way for streams", async () => {
            mockS3Client.send.mockRejectedValue(
                Object.assign(new Error("boom"), { $metadata: { httpStatusCode: 404 } })
            );
            const errorLog = jest.spyOn((service as any).logger, "error").mockImplementation();

            await expect(service.getFileStream("my-bucket", "x")).rejects.toThrow("S3 error: boom");
            expect(errorLog).not.toHaveBeenCalled();
        });

        it("keeps logging real failures as errors", async () => {
            mockS3Client.send.mockRejectedValue(new Error("Timeout"));
            const errorLog = jest.spyOn((service as any).logger, "error").mockImplementation();

            await expect(service.getFileBuffer("my-bucket", "x")).rejects.toThrow("S3 error: Timeout");
            expect(errorLog).toHaveBeenCalledTimes(1);
        });
    });

    describe("listFiles", () => {
        it("should send a ListObjectsV2Command with bucket and prefix", async () => {
            mockS3Client.send.mockResolvedValue({ Contents: [] });

            await service.listFiles("my-bucket", "some/prefix");

            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: { Bucket: "my-bucket", Prefix: "some/prefix" },
                })
            );
        });

        it("should omit prefix when not provided", async () => {
            mockS3Client.send.mockResolvedValue({ Contents: [] });

            await service.listFiles("my-bucket");

            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: { Bucket: "my-bucket", Prefix: undefined },
                })
            );
        });

        it("should map Contents entries into S3ObjectSummary objects", async () => {
            const lastModified = new Date("2024-01-01T00:00:00Z");
            mockS3Client.send.mockResolvedValue({
                Contents: [
                    { Key: "file1.txt", Size: 123, LastModified: lastModified, ETag: "\"abc\"" },
                ],
            });

            const result = await service.listFiles("my-bucket");

            expect(result).toEqual([
                { key: "file1.txt", size: 123, lastModified, eTag: "\"abc\"" },
            ]);
        });

        it("should return an empty array when Contents is undefined", async () => {
            mockS3Client.send.mockResolvedValue({});

            const result = await service.listFiles("my-bucket");

            expect(result).toEqual([]);
        });

        it("should throw a wrapped error when listing fails", async () => {
            mockS3Client.send.mockRejectedValue(new Error("Access denied"));

            await expect(service.listFiles("my-bucket")).rejects.toThrow(
                "S3 error: Access denied"
            );
        });
    });

    describe("deleteFile", () => {
        it("should send a DeleteObjectCommand with the correct params", async () => {
            mockS3Client.send.mockResolvedValue({});

            await service.deleteFile("my-bucket", "path/to/file.txt");

            expect(mockS3Client.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: { Bucket: "my-bucket", Key: "path/to/file.txt" },
                })
            );
        });

        it("should throw a wrapped error when the delete fails", async () => {
            mockS3Client.send.mockRejectedValue(new Error("Access denied"));

            await expect(service.deleteFile("my-bucket", "path/to/file.txt")).rejects.toThrow(
                "S3 error: Access denied"
            );
        });
    });
});
