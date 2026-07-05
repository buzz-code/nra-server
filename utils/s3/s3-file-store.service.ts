import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { S3Service } from "./s3.service";

/**
 * Convenience wrapper around S3Service for entities that generate a single file
 * (e.g. a report or an audio render) and need to store/serve/discard it.
 * Reads the shared bucket from S3_BUCKET; callers only deal with keys.
 */
@Injectable()
export class S3FileStoreService {
    constructor(private readonly s3Service: S3Service) {}

    private get bucket(): string {
        return process.env.S3_BUCKET;
    }

    /**
     * Build a unique key under the given prefix, e.g. buildKey("story-voices", 12, "mp3")
     */
    buildKey(prefix: string, id: number | string, extension: string): string {
        return `${prefix}/${prefix}-${id}-${randomUUID()}.${extension}`;
    }

    async upload(key: string, body: Buffer, contentType?: string): Promise<void> {
        await this.s3Service.uploadFile(this.bucket, key, body, contentType);
    }

    async download(key: string): Promise<Buffer> {
        return this.s3Service.getFileBuffer(this.bucket, key);
    }

    async remove(key: string): Promise<void> {
        await this.s3Service.deleteFile(this.bucket, key);
    }
}
