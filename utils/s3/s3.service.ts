import { Inject, Injectable, Logger } from "@nestjs/common";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "stream";

export const S3_CLIENT = Symbol("S3_CLIENT");

export interface S3ObjectSummary {
    key: string;
    size?: number;
    lastModified?: Date;
    eTag?: string;
}

@Injectable()
export class S3Service {
    private readonly logger = new Logger(S3Service.name);

    constructor(@Inject(S3_CLIENT) private readonly s3Client: S3Client) {}

    /**
     * Upload a file to the given bucket/key
     */
    async uploadFile(bucket: string, key: string, body: Buffer, contentType?: string): Promise<void> {
        try {
            await this.s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            }));
        } catch (error) {
            this.logger.error(`Failed to upload file ${bucket}/${key}: ${error.message}`, error.stack);
            throw new Error(`S3 error: ${error.message}`);
        }
    }

    /**
     * Fetch a file as a stream, e.g. for playback
     */
    async getFileStream(bucket: string, key: string): Promise<Readable> {
        try {
            return await this.getObjectStream(bucket, key);
        } catch (error) {
            this.logger.error(`Failed to get file stream ${bucket}/${key}: ${error.message}`, error.stack);
            throw new Error(`S3 error: ${error.message}`);
        }
    }

    /**
     * Fetch a file fully buffered into memory
     */
    async getFileBuffer(bucket: string, key: string): Promise<Buffer> {
        try {
            const stream = await this.getObjectStream(bucket, key);
            return await streamToBuffer(stream);
        } catch (error) {
            this.logger.error(`Failed to get file buffer ${bucket}/${key}: ${error.message}`, error.stack);
            throw new Error(`S3 error: ${error.message}`);
        }
    }

    /**
     * List files in a bucket, optionally under a prefix
     */
    async listFiles(bucket: string, prefix?: string): Promise<S3ObjectSummary[]> {
        try {
            const response = await this.s3Client.send(new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix,
            }));
            return (response.Contents ?? []).map((object) => ({
                key: object.Key,
                size: object.Size,
                lastModified: object.LastModified,
                eTag: object.ETag,
            }));
        } catch (error) {
            this.logger.error(`Failed to list files in ${bucket} (prefix: ${prefix}): ${error.message}`, error.stack);
            throw new Error(`S3 error: ${error.message}`);
        }
    }

    /**
     * Delete a file from the given bucket/key
     */
    async deleteFile(bucket: string, key: string): Promise<void> {
        try {
            await this.s3Client.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
            }));
        } catch (error) {
            this.logger.error(`Failed to delete file ${bucket}/${key}: ${error.message}`, error.stack);
            throw new Error(`S3 error: ${error.message}`);
        }
    }

    private async getObjectStream(bucket: string, key: string): Promise<Readable> {
        const response = await this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return response.Body as Readable;
    }
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}
