import { HttpService } from '@nestjs/axios';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { MailAddress } from '@shared/entities/MailAddress.entity';
import { firstValueFrom, Observable, tap } from 'rxjs';

@Injectable()
export class MailAddressUpdateInterceptor implements NestInterceptor {
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
            const { data } = await firstValueFrom(
                this.httpService.post('https://n8n.yoman.online/webhook/save-mail-address', response)
            );
            console.log('saved mail_address', data);
        } catch (e) {
            console.log('could not save mail_address', e);
        }
    }
}
