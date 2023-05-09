import { HttpService } from '@nestjs/axios';
import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { mailWorkflowUrls } from '@shared/config/mail-workflows';
import { MailAddress } from '@shared/entities/MailAddress.entity';
import { Request } from 'express';
import { firstValueFrom, Observable, switchMap, tap, throwError } from 'rxjs';

@Injectable()
export class MailAddressDeleteInterceptor implements NestInterceptor {
    constructor(private httpService: HttpService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            tap((data) => {
                this.saveForWebhook(data);
                return data;
            }),
        );
    }

    private async saveForWebhook(response: MailAddress) {
        try {
            const body = {
                ...response,
                serverName: process.env.DOMAIN_NAME,
            };
            const { data } = await firstValueFrom(
                this.httpService.post(mailWorkflowUrls.deleteMailAddress, body)
            );
            console.log('deleted mail_address', data);
        } catch (e) {
            console.log('could not delete mail_address', e);
        }
    }
}
