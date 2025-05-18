import { DynamicModule, Module } from '@nestjs/common';
import { YEMOT_HANDLER_FACTORY, YemotHandlerFactory, YemotRouterService } from './yemot-router.service';

/**
 * Module that provides the Yemot router functionality
 */
@Module({
  providers: [YemotRouterService],
  exports: [YemotRouterService],
})
export class YemotModule {
  static register(factory: YemotHandlerFactory): DynamicModule {
    return {
      module: YemotModule,
      providers: [
        {
          provide: YEMOT_HANDLER_FACTORY,
          useValue: factory,
        },
      ],
    };
  }
}
