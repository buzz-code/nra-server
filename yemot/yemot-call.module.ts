import { YemotCall, YemotParams } from "../entities/YemotCall.entity";
import { snakeCase } from "snake-case";

export const YEMOT_PROCCESSOR = 'yemot_processor';
export const YEMOT_HANGUP_STEP = 'hangup';
export const YEMOT_NOT_IMPL_STEP = 'error-not-impl-step';
export abstract class YemotProccessor {
  steps: { [key: string]: string };
  abstract processCall(activeCall: YemotCall, body: YemotParams): Promise<{ response: string; nextStep: string; }>;
}

// sevice
import { Injectable, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TypeOrmCrudService } from "@nestjsx/crud-typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/User.entity";
import yemotUtil from "./yemot.util";

@Injectable()
export class YemotCallService extends TypeOrmCrudService<YemotCall> {
  constructor(@InjectRepository(YemotCall) repo,
    @InjectRepository(User) private userRepo: Repository<User>,
    @Inject(YEMOT_PROCCESSOR) private yemotProccessor: YemotProccessor) {
    super(repo);
  }

  // {"ApiCallId":"754b9ce7c434ea952f2ed99671c274fee143165a","ApiYFCallId":"9da82d44-c071-4c61-877b-1680d75968e6","ApiDID":"035586526","ApiRealDID":"035586526","ApiPhone":"0527609942","ApiExtension":"","ApiTime":"1669485562","reportDateType":"2","reportDate":"10112022","reportDateConfirm":"1","questionAnswer":"1","howManyLessons":"2","howManyWatchOrIndividual":"1","howManyTeachedOrInterfering":"0","wasKamal":"0","howManyDiscussingLessons":"1"}
  async handleCall(body: YemotParams) {
    const activeCall = await this.getActiveCall(body);
    try {
      if (body.hangup) {
        if (activeCall.currentStep !== YEMOT_HANGUP_STEP) {
          throw new Error('Unexpected hangup');
        } else {
          this.closeCall(activeCall, body);
        }
      } else {
        const { response, nextStep } = await this.yemotProccessor.processCall(activeCall, body);
        this.saveStep(activeCall, body, response, nextStep);
        return response;
      }
    }
    catch (e) {
      activeCall.isOpen = false;
      activeCall.hasError = true;
      activeCall.errorMessage = e.message;
      this.repo.save(activeCall);

      return yemotUtil.hangup();
    }
  }

  private async getActiveCall(body: YemotParams) {
    const userFilter = {
      phoneNumber: body.ApiDID
    };
    const call = await this.repo.findOne({
      where: {
        apiCallId: body.ApiCallId
      }
    });
    if (call) {
      return call;
    }
    const user = await this.userRepo.findOneByOrFail(userFilter)
    return this.repo.create({
      user,
      apiCallId: body.ApiCallId,
      phone: body.ApiPhone,
      isOpen: true,
      history: [],
      currentStep: 'initial',
      data: {},
    })
  }
  private saveStep(activeCall: YemotCall, body: YemotParams, response: string, nextStep: string) {
    activeCall.currentStep = nextStep;
    activeCall.history.push({
      params: body,
      response,
      time: new Date(),
    })
    if (nextStep === YEMOT_HANGUP_STEP) {
      activeCall.isOpen = false;
    }
    this.repo.save(activeCall);
  }
  private closeCall(activeCall: YemotCall, body: YemotParams) {
    activeCall.isOpen = false;
    activeCall.history.push({
      params: body,
      response: 'hangup',
      time: new Date(),
    })
    this.repo.save(activeCall);
  }
}


// controller
import { Controller, UseGuards, Post, Request, Body } from "@nestjs/common";
import { Crud, CrudController, CrudAuth } from "@nestjsx/crud";
import { CrudAuthFilter } from "../auth/crud-auth.filter";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Crud({
  model: {
    type: YemotCall,
  },
})
// @UseGuards(JwtAuthGuard)
// @CrudAuth(CrudAuthFilter)
@Controller(snakeCase(YemotCall.name))
export class YemotCallController implements CrudController<YemotCall> {
  constructor(public service: YemotCallService) { }

  @Post('handle-call')
  async handleCall(@Request() req, @Body() body) {
    return this.service.handleCall(body)
  }
}


// module
import { Module, DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({})
export class YemotCallModule {
  static register(yemotProccessor: YemotProccessor): DynamicModule {
    return {
      module: YemotCallModule,
      imports: [TypeOrmModule.forFeature([YemotCall, User])],
      providers: [
        {
          provide: YEMOT_PROCCESSOR,
          useValue: yemotProccessor,
        },
        YemotCallService],
      exports: [YemotCallService],
      controllers: [YemotCallController],
    }
  }
}
