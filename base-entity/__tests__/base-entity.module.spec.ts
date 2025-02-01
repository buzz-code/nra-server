import { Test, TestingModule } from '@nestjs/testing';
import { BaseEntityModule, validationPipeOptions } from '../base-entity.module';
import { BaseEntityService } from '../base-entity.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BaseEntityController } from '../base-entity.controller';
import { Entity as TypeOrmEntity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Repository, EntityManager, SelectQueryBuilder, QueryRunner } from 'typeorm';
import { ENTITY_EXPORTER, ENTITY_REPOSITORY, ENTITY_SERVICE, IHasUserId, Entity } from '../interface';
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
class MockMailModule { }

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

  describe('Register', () => {
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

    it('should register the entity service', () => {
      expect(module.get(ENTITY_SERVICE)).toBeDefined();
    });
  });

  describe('ValidationPipeOptions', () => {
    it('should handle validation errors correctly', () => {
      const validationFactory = validationPipeOptions.exceptionFactory;

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

    it('should handle nested validation errors correctly', () => {
      const validationFactory = validationPipeOptions.exceptionFactory;

      expect(validationFactory).toBeDefined();

      const mockErrors: ValidationError[] = [
        {
          property: 'test',
          value: undefined,
          children: [
            {
              property: 'nested',
              children: [
                {
                  property: 'nested',
                  value: undefined,
                  constraints: { isNotEmpty: 'Field should not be empty' },
                  children: [],
                  target: {},
                  contexts: {}
                }
              ]
            }
          ],
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

  describe('BaseEntityController', () => {
    let controller: BaseEntityController<TestEntity>;
    let mockService: MockBaseService<TestEntity>;

    beforeEach(() => {
      mockService = module.get(ENTITY_SERVICE);
      const baseEntityModule = BaseEntityModule.register({
        ...mockEntityOptions,
      });
      controller = new baseEntityModule.controllers[0](mockService);
    });

    it('should be defined', () => {
      expect(controller).toBeDefined();
      expect(controller.service).toBeDefined();
      expect(controller.service).toBeInstanceOf(BaseEntityService);
    });

    it('should return the count of entities', async () => {
      const count = 10;
      jest.spyOn(mockService, 'getCount').mockResolvedValue({ count });
      const req = { parsed: { extra: { format: 'json' } } };

      const result = await controller.getCount(req as any);
      expect(result).toEqual({ count });
    });

    it('should export a file', async () => {
      jest.spyOn(mockService, 'getDataForExport').mockResolvedValue([{ id: 1, name: 'Test' }]);
      jest.spyOn(mockService, 'getExportHeaders').mockReturnValue(['id', 'name']);
      jest.spyOn(mockService, 'getName').mockReturnValue('test');

      const req = {
        parsed: { extra: { format: 'json' } },
        auth: { user: { isPaid: true } }
      };

      const result = await controller['exportFile'](req as any);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('disposition');
      expect(result).toHaveProperty('type');
    });

    it('should get report data', async () => {
      const mockGetReportData = BaseEntityController.prototype['getReportData'] = jest.fn().mockResolvedValue({});

      const req = {
        parsed: { extra: { format: 'json' } },
        auth: { user: { isPaid: true } }
      };

      const result = await controller['getReportData'](req as any);
      expect(mockGetReportData).toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should do an action', async () => {
      const mockDoAction = BaseEntityController.prototype['doAction'] = jest.fn().mockResolvedValue({});

      const req = {
        parsed: { extra: { format: 'json' } },
        auth: { user: { isPaid: true } }
      };

      const result = await controller['doAction'](req as any, {});
      expect(mockDoAction).toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should get pivot data', async () => {
      const mockGetPivotData = BaseEntityController.prototype['getPivotData'] = jest.fn().mockResolvedValue({});

      const req = {
        parsed: { extra: { format: 'json' } },
        auth: { user: { isPaid: true } }
      };

      const result = await controller['getPivotData'](req as any);
      expect(mockGetPivotData).toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle email', async () => {
      const mockGetUserIdFromMailAddress = BaseEntityController.prototype['getUserIdFromMailAddress'] = jest.fn().mockResolvedValue(1);
      const mockImportExcelFile = BaseEntityController.prototype['importExcelFile'] = jest.fn().mockResolvedValue({});
      const mockSaveEmailData = BaseEntityController.prototype['saveEmailData'] = jest.fn().mockResolvedValue({});
      const mockGetBccAddressFromUserId = BaseEntityController.prototype['getBccAddressFromUserId'] = jest.fn().mockResolvedValue('test');

      const body = {
        mail_data: {
          to: 'test@example.com',
          attachments: [
            { filename: 'test.xlsx', data: 'test' }
          ] as AttachmentData[],
        }
      };

      const result = await controller['handleEmail'](body);
      expect(mockGetUserIdFromMailAddress).toHaveBeenCalledWith('test@example.com')
      expect(mockImportExcelFile).toHaveBeenCalledWith(1, 'test', 'test.xlsx', ImportFileSource.Email);
      expect(mockSaveEmailData).toHaveBeenCalledWith(1, body.mail_data, [{}]);
      expect(mockGetBccAddressFromUserId).toHaveBeenCalledWith(1);
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        bcc: 'test', html: expect.any(String), subject: 'Re:', text: expect.any(String),
      }));
    });
  });
});