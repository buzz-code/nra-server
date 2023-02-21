import { YemotCall } from "../../entities/YemotCall.entity";
import { Controller, UseGuards, Post, Body, Module, DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { YemotService } from "./yemot.service";
import { YemotProcessorProvider, YEMOT_PROCCESSOR } from "./yemot.interface";
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
  static register(processor: YemotProcessorProvider): DynamicModule {
    return {
      module: YemotModule,
      imports: [TypeOrmModule.forFeature([YemotCall, User])],
      providers: [
        {
          provide: YEMOT_PROCCESSOR,
          useValue: processor,
        },
        YemotService
      ],
      exports: [YemotService],
      controllers: [YemotController],
    }
  }
}
