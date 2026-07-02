import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Observable, tap } from 'rxjs';
import { Text } from '@shared/entities/Text.entity';
import { User } from '@shared/entities/User.entity';
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

        const ids = [getTextByUserCacheId(text.userId, text.name)];
        if (text.userId === 0) {
            // base text changed - also invalidate every user relying on the fallback value
            const users = await this.dataSource.getRepository(User).find({ select: ['id'] });
            ids.push(...users.map(user => getTextByUserCacheId(user.id, text.name)));
        }

        await this.dataSource.queryResultCache?.remove(ids);
    }
}
