import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Observable, tap } from 'rxjs';
import { Text } from '@shared/entities/Text.entity';
import { getTextByUserCacheId } from '@shared/view-entities/TextByUser.entity';

@Injectable()
export class TextCacheInvalidateInterceptor implements NestInterceptor {
    constructor(@InjectDataSource() private dataSource: DataSource) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            tap((result: Text) => {
                this.invalidateCache(result).catch(err => console.log('could not invalidate text cache', err));
            }),
        );
    }

    private async invalidateCache(text: Text): Promise<void> {
        if (!text?.name) {
            return;
        }

        await this.dataSource.queryResultCache?.remove([getTextByUserCacheId(text.userId, text.name)]);
    }
}
