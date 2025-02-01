import { HttpService } from '@nestjs/axios';
import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { mailWorkflowUrls } from '@shared/config/mail-workflows';
import { MailAddress } from '@shared/entities/MailAddress.entity';
import { Request } from 'express';
import { firstValueFrom, Observable, switchMap, tap, throwError } from 'rxjs';

@Injectable()
export class MailAddressUpdateInterceptor implements NestInterceptor {
    constructor(private httpService: HttpService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const { body } = context?.switchToHttp()?.getRequest<Request>();

        if (!body) {
            return next.handle();
        }

        return this.httpService.post(mailWorkflowUrls.validateMailQnique, body)
            .pipe(
                switchMap(validationResponse => {
                    if (body.alias && !validationResponse.data.valid) {
                        return throwError(() => new BadRequestException('כתובת המייל כבר תפוסה'));
                    }
                    return next.handle().pipe(
                        tap((data) => {
                            this.saveForWebhook(data);
                            return data;
                        }),
                    );
                })
            );
    }

    private async saveForWebhook(response: MailAddress) {
        try {
            const body = {
                ...response,
                serverName: process.env.DOMAIN_NAME,
            };
            const { data } = await firstValueFrom(
                this.httpService.post(mailWorkflowUrls.saveMailAddress, body)
            );
            console.log('saved mail_address', data);
        } catch (e) {
            console.log('could not save mail_address', e);
        }
    }
}
