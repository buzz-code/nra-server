import { CreateManyDto, CrudRequest } from '@dataui/crud';
import { BadRequestException } from '@nestjs/common';
import { DeepPartial, Repository } from 'typeorm';
import { BaseEntityService } from '@shared/base-entity/base-entity.service';
import { BaseEntityModuleOptions, InjectEntityRepository } from '@shared/base-entity/interface';
import { Schedule } from '@shared/entities/Schedule.entity';
import { MailSendService } from '@shared/utils/mail/mail-send.service';
import { ScheduleSyncService } from '@shared/utils/jobs/schedule-sync.service';

/** Fields that change when or what a schedule runs; edits to others (e.g. name) keep the pending job. */
const RUN_FIELDS: (keyof Schedule)[] = ['cronExpression', 'timeZone', 'active', 'jobType', 'payload', 'userId'];

/** Re-syncs a schedule's pending job whenever the schedule row changes. */
class ScheduleService extends BaseEntityService<Schedule> {
  constructor(
    @InjectEntityRepository repo: Repository<Schedule>,
    mailSendService: MailSendService,
    private readonly scheduleSync: ScheduleSyncService,
  ) {
    super(repo, mailSendService);
  }

  async createOne(req: CrudRequest<any>, dto: DeepPartial<Schedule>): Promise<Schedule> {
    this.validateCron(dto);
    const schedule = await super.createOne(req, dto);
    await this.scheduleSync.sync(schedule.id);
    return schedule;
  }

  async createMany(req: CrudRequest<any>, dto: CreateManyDto<DeepPartial<Schedule>>): Promise<Schedule[]> {
    dto.bulk.forEach((item) => this.validateCron(item));
    const schedules = await super.createMany(req, dto);
    for (const schedule of schedules) {
      await this.scheduleSync.sync(schedule.id);
    }
    return schedules;
  }

  async updateOne(req: CrudRequest<any>, dto: DeepPartial<Schedule>): Promise<Schedule> {
    if ('cronExpression' in dto || 'timeZone' in dto) {
      this.validateCron({ ...(await this.getOne(req)), ...dto });
    }
    const schedule = await super.updateOne(req, dto);
    if (RUN_FIELDS.some((field) => field in dto)) {
      await this.scheduleSync.sync(schedule.id);
    }
    return schedule;
  }

  async replaceOne(req: CrudRequest<any>, dto: DeepPartial<Schedule>): Promise<Schedule> {
    this.validateCron(dto);
    const schedule = await super.replaceOne(req, dto);
    await this.scheduleSync.sync(schedule.id);
    return schedule;
  }

  async deleteOne(req: CrudRequest<any>): Promise<void | Schedule> {
    const id = Number(req.parsed.paramsFilter.find((filter) => filter.field === 'id')?.value);
    const result = await super.deleteOne(req);
    if (id) {
      await this.scheduleSync.sync(id);
    }
    return result;
  }

  private validateCron(dto: DeepPartial<Schedule>): void {
    if (!this.scheduleSync.isValid({ cronExpression: dto.cronExpression as string, timeZone: dto.timeZone as string })) {
      throw new BadRequestException(`ביטוי תזמון לא תקין: ${dto.cronExpression}`);
    }
  }
}

/** Full CRUD: users manage their recurring schedules as data. */
function getConfig(): BaseEntityModuleOptions {
  return {
    entity: Schedule,
    service: ScheduleService,
  };
}

export default getConfig();
