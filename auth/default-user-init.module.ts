import { Injectable, Module } from '@nestjs/common';
import { IUserInitializationService, USER_INITIALIZATION_SERVICE } from './user-initialization.interface';
import { User } from '@shared/entities/User.entity';

@Injectable()
export class DefaultUserInitializationService implements IUserInitializationService {
  async initializeUserData(_user: User): Promise<void> {
    // No-op: projects that need initialization should provide their own module
  }
}

@Module({
  providers: [
    DefaultUserInitializationService,
    {
      provide: USER_INITIALIZATION_SERVICE,
      useExisting: DefaultUserInitializationService,
    },
  ],
  exports: [DefaultUserInitializationService, USER_INITIALIZATION_SERVICE],
})
export class DefaultUserInitModule { }
