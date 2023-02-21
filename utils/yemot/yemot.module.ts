import { YemotCall } from "../../entities/YemotCall.entity";
import { Controller, UseGuards, Post, Body, Module, DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { YemotService } from "./yemot.service";
import { YemotProcessorProvider, YEMOT_PROCCESSOR_PROVIDER } from "./yemot.interface";
import { User } from "@shared/entities/User.entity";

// todo: @UseGuards(JwtAuthGuard)
@Controller('yemot')
export class YemotController {
  constructor(public service: YemotService) { }

  @Post('handle-call')
  async handleCall(@Body() body) {
    return this.service.handleCall(body)
  }
}

@Module({})
export class YemotModule {
  static register(processorProvider: YemotProcessorProvider): DynamicModule {
    return {
      module: YemotModule,
      imports: [TypeOrmModule.forFeature([YemotCall, User])],
      providers: [
        {
          provide: YEMOT_PROCCESSOR_PROVIDER,
          useValue: processorProvider,
        },
        YemotService
      ],
      exports: [YemotService],
      controllers: [YemotController],
    }
  }
}
