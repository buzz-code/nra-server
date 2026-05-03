import { BaseEntityModule } from '@shared/base-entity/base-entity.module';
import userConfig from '@shared/entities/configs/user.config';
import textConfig from '@shared/entities/configs/text.config';
import pageConfig from '@shared/entities/configs/page.config';
import paymentTrackConfig from '@shared/entities/configs/payment-track.config';
import importFileConfig from '@shared/entities/configs/import-file.config';
import mailAddressConfig from '@shared/utils/mail/mail-address.config';
import { YemotCall } from '@shared/entities/YemotCall.entity';
import { TextByUser } from '@shared/view-entities/TextByUser.entity';
import { RecievedMail } from '@shared/entities/RecievedMail.entity';
import { Image } from '@shared/entities/Image.entity';

/**
 * Returns the 10 BaseEntityModule registrations that are common to all NRA projects.
 * Spread this into your entities module's imports array alongside project-specific registrations.
 */
export function createSharedEntitiesImports() {
  return [
    BaseEntityModule.register(userConfig),
    BaseEntityModule.register(textConfig),
    BaseEntityModule.register(pageConfig),
    BaseEntityModule.register(paymentTrackConfig),
    BaseEntityModule.register(importFileConfig),
    BaseEntityModule.register(mailAddressConfig),
    BaseEntityModule.register({ entity: YemotCall }),
    BaseEntityModule.register({ entity: TextByUser }),
    BaseEntityModule.register({ entity: RecievedMail }),
    BaseEntityModule.register({ entity: Image }),
  ];
}
