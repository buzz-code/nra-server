import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '@shared/entities/Job.entity';
import { Schedule } from '@shared/entities/Schedule.entity';
import { JobService } from './job.service';
import { JobWorkerService } from './job-worker.service';
import { ScheduleHeartbeatService } from './schedule-heartbeat.service';
import { JOB_HANDLER, JobHandler } from './job.types';
import { CleanupOldJobsHandler } from './handlers/cleanup-old-jobs.handler';
import { UserDataExportHandler } from './handlers/user-data-export.handler';

/** Handlers shipped for every project. */
const SHARED_HANDLERS: Type<JobHandler>[] = [CleanupOldJobsHandler, UserDataExportHandler];

export interface JobsModuleOptions {
  /** Project-specific handlers to register alongside the shared ones. */
  handlers?: Type<JobHandler>[];
}

/**
 * Async worker infrastructure: durable jobs table + poll worker + data-driven
 * schedule heartbeat. Import once via `JobsModule.forRoot()` in the app module.
 * MailSendService and S3FileStoreService come from their global modules.
 */
@Module({})
export class JobsModule {
  static forRoot(options: JobsModuleOptions = {}): DynamicModule {
    const handlerClasses = [...SHARED_HANDLERS, ...(options.handlers ?? [])];
    const handlerAggregator: Provider = {
      provide: JOB_HANDLER,
      useFactory: (...handlers: JobHandler[]) => handlers,
      inject: handlerClasses,
    };

    return {
      module: JobsModule,
      imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([Job, Schedule])],
      providers: [
        JobService,
        JobWorkerService,
        ScheduleHeartbeatService,
        ...handlerClasses,
        handlerAggregator,
      ],
      exports: [JobService],
    };
  }
}
