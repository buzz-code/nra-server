import { DynamicModule, Module, Type } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import LocalRegisterStrategy from './local-register.strategy';
import { JwtStrategy } from './jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@shared/entities/User.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';

// Interface for AuthModule configuration
export interface AuthModuleOptions {
  userInitModule?: Type<any> | DynamicModule;
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
   * Register AuthModule, optionally providing a user initialization module.
   * If no userInitModule is provided, the module handles its own initialization.
   */
  static forRoot(options?: AuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      imports: options?.userInitModule ? [options.userInitModule] : [],
    };
  }
}
