import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { AuditLog } from '@shared/entities/AuditLog.entity';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { DataSource } from 'typeorm';

interface RequestInterface {
    originalUrl: Request['originalUrl'];
    method: Request['method'];
    params: Request['params'];
};
interface ResponseInterface {
    statusCode: number;
    data: any;
};
const MAX_VALUE_LENGTH = 20_000_000;

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
    constructor(@InjectDataSource() private dataSource: DataSource) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const http = context?.switchToHttp();
        if (!http) {
            return next.handle();
        }

        const req = http.getRequest<Request>();
        const { statusCode } = http.getResponse<Response>();
        const { originalUrl, method, params, user } = req;

        const request: RequestInterface = { originalUrl, method, params };

        return next.handle().pipe(
            tap((data) => {
                const response: ResponseInterface = { statusCode, data };
                this.insertMongo(request, response, user);
            }),
        );
    }

    private async insertMongo(request: RequestInterface, response: ResponseInterface, user: any) {
        try {
            const data = { ...response.data };
            Object.entries(data).forEach(([key, value]) => {
                const jsonValue = JSON.stringify(value);
                if (jsonValue.length > MAX_VALUE_LENGTH) {
                    data[key] = jsonValue.substr(0, MAX_VALUE_LENGTH);
                }
            });

            const logInfo: Partial<AuditLog> = {
                userId: user?.id,
                entityId: Number(request.params.id),
                entityName: request.originalUrl.split('/')[1],
                entityData: data,
                operation: request.method,
            };

            await this.dataSource.getRepository(AuditLog).save(logInfo);
        } catch (error) {
            console.error('Failed to save audit log:', error);
        }
    }
}
