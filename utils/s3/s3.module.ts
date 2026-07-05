import { Global, Module } from "@nestjs/common";
import { S3Client } from "@aws-sdk/client-s3";
import { S3_CLIENT, S3Service } from "./s3.service";
import { S3FileStoreService } from "./s3-file-store.service";

@Global()
@Module({
    providers: [
        {
            provide: S3_CLIENT,
            useFactory: (): S3Client =>
                new S3Client({
                    endpoint: process.env.S3_ENDPOINT,
                    region: process.env.S3_REGION ?? "us-east-1",
                    forcePathStyle: true,
                    credentials: {
                        accessKeyId: process.env.S3_ACCESS_KEY_ID,
                        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
                    },
                }),
        },
        S3Service,
        S3FileStoreService,
    ],
    exports: [S3Service, S3FileStoreService],
})
export class S3Module {}
