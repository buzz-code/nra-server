import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import LocalRegisterStrategy from './local-register.strategy';
import { JwtStrategy } from './jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@shared/entities/User.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { IUserInitializationService, USER_INITIALIZATION_SERVICE } from './user-initialization.interface';

// Interface for AuthModule configuration
export interface AuthModuleOptions {
  userInitServiceType?: Type<IUserInitializationService>;
  imports?: any[];
}

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: jwtConstants.maxAge },
    }),
  ],
  providers: [AuthService, LocalStrategy, LocalRegisterStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {
  /**
   * Register AuthModule with an initialization service from another module
   */
  static forRootAsync(options: AuthModuleOptions): DynamicModule {
    const providers: Provider[] = [];

    if (options.userInitServiceType) {
      providers.push({
        provide: USER_INITIALIZATION_SERVICE,
        useExisting: options.userInitServiceType,
      });
    }

    return {
      module: AuthModule,
      imports: options.imports || [],
      providers,
    };
  }
}