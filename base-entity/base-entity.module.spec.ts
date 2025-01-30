import { Test, TestingModule } from '@nestjs/testing';
import { BaseEntityModule } from './base-entity.module';
import { BaseEntityService } from './base-entity.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BaseEntityController } from './base-entity.controller';
import { Entity as TypeOrmEntity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Repository, EntityManager, SelectQueryBuilder, QueryRunner } from 'typeorm';
import { ENTITY_EXPORTER, ENTITY_REPOSITORY, ENTITY_SERVICE, IHasUserId, Entity } from './interface';
import { HttpException, Module, ValidationPipeOptions } from '@nestjs/common';
import { BaseRouteName, CrudOptions } from '@dataui/crud';
import { MailSendService } from '@shared/utils/mail/mail-send.service';
import { MailerService } from '@nestjs-modules/mailer';
import { MailData, AttachmentData } from '@shared/utils/mail/interface';
import { ImportFile, ImportFileSource } from '@shared/entities/ImportFile.entity';
import { ValidationError } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { Provider } from '@nestjs/common';
import { Global } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TypeOrmCrudService } from '@dataui/crud-typeorm';

// Create a mock entity for testing that implements required User properties
@TypeOrmEntity()
class TestEntity implements IHasUserId {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  email: string | null;

  @Column({ nullable: true })
  password: string | null;

  @Column({ nullable: true })
  @Index("user_phone_number_idx")
  phoneNumber: string | null;

  @Column({ nullable: true })
  active: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  effective_id: number;

  @Column("simple-json", { nullable: true })
  permissions: any;

  @Column("simple-json", { nullable: true })
  additionalData: any;

  @Column("simple-json", { nullable: true })
  userInfo: any;

  @Column({ default: false })
  isPaid: boolean;

  @Column({ nullable: true })
  paymentMethod: string;

  @Column({ nullable: true })
  mailAddressAlias: string;

  @Column({ nullable: true })
  mailAddressTitle: string;

  @Column({ nullable: true })
  paymentTrackId: number;

  @Column({ nullable: true })
  bccAddress: string;

  @Column()
  userId: number;

  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}

const crudOptions: CrudOptions = {
  model: {
    type: TestEntity,
  },
  query: {
    join: {
      user: {
        eager: true,
      },
    },
  },
  routes: {
    only: ['getManyBase' as BaseRouteName],
  },
  params: {
    id: {
      field: 'id',
      type: 'number',
    },
  },
  validation: {
    transform: true,
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors: ValidationError[]) => {
      if (errors[0]?.children?.flatMap(i => i.children)?.length) {
        errors = errors[0].children.flatMap(i => i.children);
      }
      const errorMessages = errors.flatMap(item => item.constraints ? Object.values(item.constraints) : []);
      const uniqueErrors = [...new Set(errorMessages)];
      return new HttpException({ message: uniqueErrors.join(', ') }, 400);
    }
  } as ValidationPipeOptions
};

// Create a mock mail send service
@Global()
@Module({
  providers: [
    {
      provide: MailerService,
      useValue: {
        sendMail: jest.fn().mockResolvedValue(undefined),
      },
    },
    MailSendService,
  ],
  exports: [MailerService, MailSendService],
})
class MockMailModule {}

// Create a mock base service that properly initializes TypeOrmCrudService
class MockBaseService<T extends Entity> extends BaseEntityService<T> {
  constructor(repo: Repository<T>, mailService: MailSendService) {
    super(repo, mailService);
    Object.assign(this, {
      options: crudOptions,
    });
  }
}

describe('BaseEntityModule', () => {
  let module: TestingModule;
  let mockMailerService: jest.Mocked<MailerService>;

  const mockEntityOptions = {
    ...crudOptions,
    entity: TestEntity,
    service: MockBaseService,
  };

  const mockRepository = {
    target: TestEntity,
    manager: {
      transaction: jest.fn((cb) => cb()),
    },
    metadata: {
      columns: [
        { propertyName: 'id' },
        { propertyName: 'name' },
        { propertyName: 'userId' }
      ],
      connection: { options: { type: 'mysql' } },
      targetName: 'TestEntity'
    },
    createQueryBuilder: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    save: jest.fn().mockImplementation(entity => Promise.resolve(entity))
  } as any;

  beforeEach(async () => {
    const baseEntityModule = BaseEntityModule.register({
      ...mockEntityOptions,
    });

    module = await Test.createTestingModule({
      imports: [
        MockMailModule,
        baseEntityModule,
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [TestEntity],
          synchronize: true,
        }),
        HttpModule,
      ],
    })
      .overrideProvider(getRepositoryToken(TestEntity))
      .useValue(mockRepository)
      .compile();

    mockMailerService = module.get(MailerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should register the module with correct providers', () => {
    expect(module).toBeDefined();
    const entityService = module.get(ENTITY_SERVICE);
    expect(entityService).toBeInstanceOf(BaseEntityService);
  });

  it('should register module with correct imports', () => {
    const moduleRef = BaseEntityModule.register(mockEntityOptions);
    const typeOrmFeatureModule = moduleRef.imports?.find(
      (imp: any) => imp.module === TypeOrmModule
    );
    expect(typeOrmFeatureModule).toBeDefined();
    expect(moduleRef.imports).toContainEqual(HttpModule);
  });

  it('should register the entity controller', () => {
    expect(module.get(ENTITY_SERVICE)).toBeDefined();
  });

  describe('Entity Controller', () => {
    let service: BaseEntityService<TestEntity>;
    let mailSendService: MailSendService;

    beforeEach(() => {
      service = module.get(ENTITY_SERVICE);
      mailSendService = module.get(MailSendService);
    });

    it('should handle email import correctly', async () => {
      const attachment: AttachmentData = {
        filename: 'test.xlsx',
        content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1024,
        data: 'base64data',
      };

      const mockMailData: MailData = {
        id: 1,
        token: 'test-token',
        to: 'test@example.com',
        from: 'sender@example.com',
        mail_from: 'sender@example.com',
        rcpt_to: 'recipient@example.com',
        subject: 'Test Subject',
        message_id: '123',
        timestamp: Date.now(),
        size: '1024',
        spam_status: 'clean',
        bounce: false,
        received_with_ssl: true,
        cc: null,
        date: new Date().toISOString(),
        in_reply_to: null,
        references: null,
        html_body: '<p>Test</p>',
        attachment_quantity: 1,
        auto_submitted: null,
        reply_to: null,
        plain_body: 'Test',
        attachments: [attachment],
      };

      const mockImportedFiles: ImportFile[] = [{
        id: 1,
        userId: 1,
        fileName: 'test.xlsx',
        fileSource: ImportFileSource.Email,
        entityIds: [1],
        entityName: 'TestEntity',
        fullSuccess: true,
        response: 'Success',
        createdAt: new Date(),
      }];

      await mailSendService.sendEmailImportResponse(mockMailData, mockImportedFiles, 'bcc@example.com');

      expect(mockMailerService.sendMail).toHaveBeenCalled();
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: mockMailData.mail_from,
        from: mockMailData.rcpt_to,
        bcc: 'bcc@example.com',
        subject: expect.stringContaining(mockMailData.subject),
      }));
    });

    it('should handle validation errors correctly', () => {
      const moduleRef = BaseEntityModule.register(mockEntityOptions);
      expect(moduleRef.providers).toBeDefined();
      const validationFactory = (crudOptions.validation as ValidationPipeOptions).exceptionFactory;

      expect(validationFactory).toBeDefined();

      const mockErrors: ValidationError[] = [
        {
          property: 'test',
          value: undefined,
          constraints: { isNotEmpty: 'Field should not be empty' },
          children: [],
          target: {},
          contexts: {}
        }
      ];

      const error = validationFactory(mockErrors);
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getResponse()).toEqual({
        message: 'Field should not be empty',
      });
    });
  });
});