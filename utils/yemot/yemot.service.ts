import { Injectable, Inject, Logger } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { YemotCall, YemotParams } from "@shared/entities/YemotCall.entity";
import { DataSource, Repository } from "typeorm";
import { User } from "../../entities/User.entity";
import { Chain } from "./chain.interface";
import { YemotProcessor, YemotProcessorProvider, YemotRequest, YemotResponse, YEMOT_CHAIN, YEMOT_HANGUP_STEP, YEMOT_PROCCESSOR_PROVIDER } from "./yemot.interface";
import { UnexpectedHangupException, UserNotFoundException } from "./yemot.exception";
import yemotUtil from "./yemot.util";

@Injectable()
export class YemotService {
  yemotProccessor: YemotProcessor;
  activeCalls: Map<string, YemotCall> = new Map();
  private readonly logger = new Logger(YemotService.name);

  constructor(
    @InjectRepository(YemotCall) private repo: Repository<YemotCall>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectDataSource() private dataSource: DataSource,
    @Inject(YEMOT_CHAIN) private yemotChain: Chain,
  ) {
  }

  // todo: delete this {"ApiCallId":"754b9ce7c434ea952f2ed99671c274fee143165a","ApiYFCallId":"9da82d44-c071-4c61-877b-1680d75968e6","ApiDID":"035586526","ApiRealDID":"035586526","ApiPhone":"0527609942","ApiExtension":"","ApiTime":"1669485562","reportDateType":"2","reportDate":"10112022","reportDateConfirm":"1","questionAnswer":"1","howManyLessons":"2","howManyWatchOrIndividual":"1","howManyTeachedOrInterfering":"0","wasKamal":"0","howManyDiscussingLessons":"1"}
  async handleCall(body: YemotParams) {
    this.logger.log('start handleCall', body);
    let activeCall: YemotCall;
    try {
      this.cleanBodyDuplicateValues(body);
      activeCall = await this.getActiveCall(body);
      if (body.hangup) {
        if (activeCall.isOpen) {
          throw new UnexpectedHangupException(activeCall);
        } else {
          this.closeCall(activeCall, body);
        }
      } else {
        const { req, res } = this.getHandlerObjects(activeCall, body);
        await this.yemotChain.handleRequest(req, res, () => {
          // nothing here, I guess
        })
        const response = await res.getResponse();
        this.saveStep(activeCall, body, response);
        return response;
      }
    }
    catch (e) {
      let errorResponse = e.responseMessage ?? 'שגיאה';
      this.logger.log(`an error has occured in yemot_call: ${e.message}`);
      this.logger.log(`stack: ${e.stack}`);
      if (activeCall) {
        activeCall.isOpen = false;
        activeCall.hasError = true;
        activeCall.errorMessage = e.message;
        this.repo.save(activeCall);
      }
      return yemotUtil.send(
        yemotUtil.id_list_message_v2(errorResponse),
        yemotUtil.hangup(),
      );
    }
    finally {
      this.logger.log('end handleCall', body);
    }
  }

  getHandlerObjects(activeCall: YemotCall, body: YemotParams) {
    const req: YemotRequest = new YemotRequest(activeCall, this.dataSource);
    const res: YemotResponse = new YemotResponse(this.dataSource, activeCall.userId);
    return { req, res };
  }

  private cleanBodyDuplicateValues(body: YemotParams) {
    for (const key in body) {
      const value = body[key];
      if (Array.isArray(value)) {
        body[key] = value[value.length - 1];
      }
    }
  }

  private async getActiveCall(body: YemotParams) {
    let call: YemotCall;
    if (this.activeCalls.has(body.ApiCallId)) {
      call = this.activeCalls.get(body.ApiCallId);
    } else {
      call = await this.repo.findOne({
        where: {
          apiCallId: body.ApiCallId
        }
      });
    }
    if (call) {
      this.activeCalls.set(body.ApiCallId, call);
      call.data = { ...call.data, ...body };
      return call;
    }
    const userFilter = {
      phoneNumber: body.ApiDID
    };
    const user = await this.userRepo.findOneBy(userFilter);
    if (!user) {
      throw new UserNotFoundException(body.ApiDID);
    }
    return this.repo.create({
      user,
      apiCallId: body.ApiCallId,
      phone: body.ApiPhone,
      isOpen: true,
      history: [],
      data: body,
      currentStep: 'placeholder'
    })
  }

  private saveStep(activeCall: YemotCall, body: YemotParams, response: string) {
    activeCall.history.push({
      params: body,
      response,
      time: new Date(),
    })
    if (response.includes(YEMOT_HANGUP_STEP)) {
      activeCall.isOpen = false;
    }
    setTimeout(() => this.repo.save(activeCall));
  }

  private async closeCall(activeCall: YemotCall, body: YemotParams) {
    activeCall.history.push({
      params: body,
      response: YEMOT_HANGUP_STEP,
      time: new Date(),
    })
    await this.repo.save(activeCall);
    this.activeCalls.delete(body.ApiCallId);
  }
}