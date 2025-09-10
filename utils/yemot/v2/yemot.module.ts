import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YEMOT_HANDLER_FACTORY, YemotHandlerFactory, YemotRouterService } from './yemot-router.service';
import { YemotCallTrackingService } from './yemot-call-tracking.service';
import { YemotCall } from '@shared/entities/YemotCall.entity';
import { User } from '@shared/entities/User.entity';

/**
 * Module that provides the Yemot router functionality
 */
@Module({
  providers: [YemotRouterService, YemotCallTrackingService],
  exports: [YemotRouterService, YemotCallTrackingService],
})
export class YemotModule {
  static register(factory: YemotHandlerFactory): DynamicModule {
    return {
      module: YemotModule,
      imports: [TypeOrmModule.forFeature([YemotCall, User])],
      providers: [
        {
          provide: YEMOT_HANDLER_FACTORY,
          useValue: factory,
        },
        YemotRouterService,
        YemotCallTrackingService,
      ],
      exports: [YemotRouterService, YemotCallTrackingService],
    };
  }
}
