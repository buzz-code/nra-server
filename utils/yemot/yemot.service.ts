import { Injectable, Inject } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { YemotCall, YemotParams } from "@shared/entities/YemotCall.entity";
import { DataSource, Repository } from "typeorm";
import { User } from "../../entities/User.entity";
import { YemotProcessor, YemotProcessorProvider, YEMOT_HANGUP_STEP, YEMOT_PROCCESSOR_PROVIDER } from "./yemot.interface";
import yemotUtil from "./yemot.util";

@Injectable()
export class YemotService {
  yemotProccessor: YemotProcessor;

  constructor(
    @InjectRepository(YemotCall) private repo: Repository<YemotCall>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectDataSource() private dataSource: DataSource,
    @Inject(YEMOT_PROCCESSOR_PROVIDER) yemotProccessorProvider: YemotProcessorProvider
  ) {
    this.yemotProccessor = yemotProccessorProvider(this.dataSource);
  }

  // todo: delete this {"ApiCallId":"754b9ce7c434ea952f2ed99671c274fee143165a","ApiYFCallId":"9da82d44-c071-4c61-877b-1680d75968e6","ApiDID":"035586526","ApiRealDID":"035586526","ApiPhone":"0527609942","ApiExtension":"","ApiTime":"1669485562","reportDateType":"2","reportDate":"10112022","reportDateConfirm":"1","questionAnswer":"1","howManyLessons":"2","howManyWatchOrIndividual":"1","howManyTeachedOrInterfering":"0","wasKamal":"0","howManyDiscussingLessons":"1"}
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