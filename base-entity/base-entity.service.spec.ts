import { Test, TestingModule } from '@nestjs/testing';
import { BaseEntityService } from './base-entity.service';
import { Repository, DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { MailSendService } from '@shared/utils/mail/mail-send.service';
import { CrudRequest } from '@dataui/crud';
import { TypeOrmCrudService } from '@dataui/crud-typeorm';
import { validateNotTrialEnded } from './base-entity.util';
import { ENTITY_EXPORTER, ENTITY_REPOSITORY } from './interface';

jest.mock('./base-entity.util', () => ({
  validateNotTrialEnded: jest.fn(),
}));

describe('BaseEntityService', () => {
  let service: BaseEntityService<any>;
  let repository: Repository<any>;
  let dataSource: DataSource;
  let mailService: MailSendService;

  let entityColumns: string[];

  const mockReq = {
    auth: { id: 123 },
    parsed: {
      fields: [] as string[],
      paramsFilter: [] as any[],
      authPersist: [] as any[],
      search: {} as any,
      filter: [] as any[],
      or: [] as any[],
      join: [] as any[],
      sort: [] as any[],
      limit: 0,
      offset: 0,
      page: 1,
      cache: 0,
      includeDeleted: 0,
      extra: {
        pivot: '?PivotName',
      }
    },
    options: {
      route: {
        path: '',
        paramNames: [] as string[]
      },
      params: {},
      query: {},
      routes: {}
    }
  } as unknown as CrudRequest<any, any>;

  beforeEach(async () => {
    class TestEntity {
      id: number;
      name: string;
      userId?: number;
    }
    const options = {
      model: {
        type: TestEntity,
        options: {}
      }
    };

    const mockRepository = {
      target: TestEntity,
      manager: {},
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

    Object.defineProperty(mockRepository, 'entityColumns', {
      get: () => entityColumns
    });

    repository = mockRepository;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaseEntityService,
        {
          provide: ENTITY_REPOSITORY,
          useValue: repository
        },
        {
          provide: ENTITY_EXPORTER,
          useValue: {}
        },
        {
          provide: DataSource,
          useValue: {}
        },
        {
          provide: MailSendService,
          useValue: {}
        }
      ]
    }).compile();

    service = module.get<BaseEntityService<any>>(BaseEntityService);
    repository = module.get(ENTITY_REPOSITORY);
    dataSource = module.get<DataSource>(DataSource);
    mailService = module.get<MailSendService>(MailSendService);

    // Set default columns and configure getter
    entityColumns = ['id', 'name'];
    Object.defineProperty(service, 'entityColumns', {
      get: () => entityColumns,
      configurable: true
    });
  });

  describe('Core Functionality', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should get snake case name', () => {
      const entityName = 'TestEntity';
      Object.defineProperty(service, 'entityType', {
        get: () => ({ name: entityName })
      });

      const result = service.getName();

      expect(result).toBe('test_entity');
    });
  });

  describe('CRUD Operations', () => {
    const mockDto = { name: 'test' };

    beforeEach(() => {
      jest.clearAllMocks();
      // Mock super.createOne
      jest.spyOn(TypeOrmCrudService.prototype, 'createOne').mockResolvedValue({ id: 1, ...mockDto });
    });




    describe('super class interactions', () => {
      it('should call super createOne', async () => {
        const superSpy = jest.spyOn(TypeOrmCrudService.prototype, 'createOne');
        await service.createOne(mockReq, mockDto);
        expect(superSpy).toHaveBeenCalledWith(mockReq, mockDto);
      });

      it('should call super createMany', async () => {
        const mockItems = [{ name: 'test1' }, { name: 'test2' }];
        const mockCreateManyDto = { bulk: mockItems };
        const superSpy = jest.spyOn(TypeOrmCrudService.prototype, 'createMany')
          .mockResolvedValue([
            { id: 1, ...mockItems[0] },
            { id: 2, ...mockItems[1] }
          ]);

        await service.createMany(mockReq, mockCreateManyDto);
        expect(superSpy).toHaveBeenCalledWith(mockReq, mockCreateManyDto);
      });
    });

    describe('getCount', () => {
      it('should return count from query builder', async () => {
        const mockCount = 5;
        const mockBuilder = {
          getCount: jest.fn().mockResolvedValue(mockCount),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis()
        } as unknown as SelectQueryBuilder<any>;

        const createBuilderSpy = jest.spyOn(service as any, 'createBuilder')
          .mockResolvedValue(mockBuilder);

        const result = await service.getCount(mockReq);

        expect(createBuilderSpy).toHaveBeenCalledWith(
          mockReq.parsed,
          mockReq.options
        );
        expect(mockBuilder.getCount).toHaveBeenCalled();
        expect(result).toEqual({ count: mockCount });
      });
    });
  });

  describe('User Data Injection', () => {
    const mockDto = { name: 'test' };

    beforeEach(() => {
      jest.clearAllMocks();
      // Mock super.createOne
      jest.spyOn(TypeOrmCrudService.prototype, 'createOne').mockResolvedValue({ id: 1, ...mockDto });
    });

    describe('with userId column', () => {
      const mockDto = { name: 'test' };

      beforeEach(() => {
        entityColumns = ['id', 'userId', 'name'];
        Object.defineProperty(service, 'entityColumns', {
          get: () => entityColumns,
          configurable: true
        });
      });

      it('should have correct entity columns', () => {
        expect(service['entityColumns']).toEqual(entityColumns);
      });

      it('should validate trial not ended', async () => {
        await service.createOne(mockReq, mockDto);
        expect(validateNotTrialEnded).toHaveBeenCalledWith(mockReq.auth, dataSource);
      });

      it('should inject user data for single item', async () => {
        const dtoCopy = { ...mockDto };
        await service.createOne(mockReq, dtoCopy);
        expect(dtoCopy).toHaveProperty('userId', 123);
      });

      it('should inject user data for multiple items', async () => {
        const mockItems = [{ name: 'test1' }, { name: 'test2' }];
        const dtoCopy = {
          bulk: mockItems.map(item => ({ ...item }))
        };
        await service.createMany(mockReq, dtoCopy);
        dtoCopy.bulk.forEach(item => {
          expect(item).toHaveProperty('userId', 123);
        });
      });
    });

    describe('without userId column', () => {
      const mockDto = { name: 'test' };

      beforeEach(() => {
        entityColumns = ['id', 'name'];
        Object.defineProperty(service, 'entityColumns', {
          get: () => entityColumns,
          configurable: true
        });
      });

      it('should have correct entity columns', () => {
        expect(service['entityColumns']).toEqual(entityColumns);
      });

      it('should validate trial not ended', async () => {
        await service.createOne(mockReq, mockDto);
        expect(validateNotTrialEnded).toHaveBeenCalledWith(mockReq.auth, dataSource);
      });

      it('should not inject userId for single item', async () => {
        const dtoCopy = { ...mockDto };
        await service.createOne(mockReq, dtoCopy);
        expect(dtoCopy).not.toHaveProperty('userId');
      });

      it('should not inject userId for multiple items', async () => {
        const mockItems = [{ name: 'test1' }, { name: 'test2' }];
        const dtoCopy = {
          bulk: mockItems.map(item => ({ ...item }))
        };
        await service.createMany(mockReq, dtoCopy);
        dtoCopy.bulk.forEach(item => {
          expect(item).not.toHaveProperty('userId');
        });
      });
    });
  });

  describe('Export Functionality', () => {
    const baseMockReq = {
      auth: { id: 123 },
      parsed: {
        fields: [] as string[],
        paramsFilter: [] as any[],
        authPersist: [] as any[],
        search: {} as any,
        filter: [] as any[],
        or: [] as any[],
        join: [] as any[],
        sort: [] as any[],
        limit: 0,
        offset: 0,
        page: 1,
        cache: 0,
        includeDeleted: 0,
        classTransformOptions: {},
        extra: {}
      },
      options: {
        route: {
          path: '',
          paramNames: [] as string[]
        },
        params: {},
        query: {},
        routes: {}
      }
    } as unknown as CrudRequest;

    describe('getDataForExport', () => {
      it('should use custom processor when defined', async () => {
        const processedData = [{ processed: true }];
        service['exportDefinition'] = {
          processReqForExport: jest.fn().mockResolvedValue(processedData)
        } as any;

        const result = await service.getDataForExport(baseMockReq);

        expect(service['exportDefinition'].processReqForExport).toHaveBeenCalledWith(
          baseMockReq,
          expect.any(Function)
        );
        expect(result).toEqual(processedData);
      });

      it('should use inner export when no processor', async () => {
        service['exportDefinition'] = {} as any;
        const mockData = [{ id: 1 }];
        jest.spyOn(service as any, 'getDataForExportInner').mockResolvedValue(mockData);

        const result = await service.getDataForExport(baseMockReq);

        expect(result).toEqual(mockData);
      });

      it('should handle pivot data', async () => {
        const pivotReq = {
          ...baseMockReq,
          parsed: {
            ...baseMockReq.parsed,
            extra: { pivot: true }
          }
        };
        const pivotData = [{ id: 1, pivotField: 'value' }];
        jest.spyOn(service, 'getPivotData').mockResolvedValue(pivotData);

        const result = await service.getDataForExport(pivotReq);

        expect(service.getPivotData).toHaveBeenCalledWith(pivotReq);
        expect(result).toEqual(pivotData);
      });
    });

    describe('getExportHeaders', () => {
      it('should use custom headers when defined', () => {
        const customHeaders = [{ field: 'name', header: 'Name' }];
        service['exportDefinition'] = {
          getExportHeaders: jest.fn().mockReturnValue(customHeaders)
        } as any;

        const result = service.getExportHeaders(baseMockReq, []);

        expect(service['exportDefinition'].getExportHeaders).toHaveBeenCalledWith(entityColumns);
        expect(result).toEqual(customHeaders);
      });

      it('should use entity columns as default headers', () => {
        service['exportDefinition'] = {} as any;
        const result = service.getExportHeaders(baseMockReq, []);
        expect(result).toEqual(entityColumns);
      });

      it('should include pivot headers when present', () => {
        const pivotReq = {
          ...baseMockReq,
          parsed: {
            ...baseMockReq.parsed,
            extra: { pivot: true }
          }
        };
        const pivotData = [{ headers: ['pivot1', 'pivot2'] }];

        const result = service.getExportHeaders(pivotReq, pivotData);

        expect(result).toEqual([...entityColumns, 'pivot1', 'pivot2']);
      });
    });

    describe('getImportDefinition', () => {
      beforeEach(() => {
        entityColumns = ['id', 'name', 'userId', 'createdAt', 'updatedAt', 'customField'];
      });

      it('should filter out system fields', () => {
        const result = service.getImportDefinition();
        expect(result.importFields).toEqual(['name', 'customField']);
      });

      it('should use custom import definition when available', () => {
        const customDefinition = { importFields: ['name'], someCustomProp: true };
        service['exportDefinition'] = {
          getImportDefinition: jest.fn().mockReturnValue(customDefinition)
        } as any;

        const result = service.getImportDefinition();
        expect(result).toEqual(customDefinition);
        expect(service['exportDefinition'].getImportDefinition)
          .toHaveBeenCalledWith(['name', 'customField']);
      });
    });
  });

  describe('Report & Pivot Operations', () => {
    describe('getReportData', () => {
      it('should create report generator', async () => {
        const result = await service.getReportData(mockReq);

        expect(result.generator).toBeDefined();
        expect(result.params).toEqual(mockReq.parsed.extra);
      });
    });

    describe('getPivotData', () => {
      it('should get data from getMany', async () => {
        const mockData = [{ id: 1 }];
        jest.spyOn(service, 'getMany').mockResolvedValue(mockData);

        const result = await service.getPivotData(mockReq);

        expect(service.getMany).toHaveBeenCalledWith(mockReq);
        expect(result).toEqual(mockData);
      });

      it('should populate pivot data when records exist', async () => {
        const mockData = [{ id: 1 }];
        jest.spyOn(service, 'getMany').mockResolvedValue(mockData);
        jest.spyOn(service as any, 'populatePivotData');

        const result = await service.getPivotData(mockReq);

        expect(service['populatePivotData']).toHaveBeenCalledWith('PivotName', mockData, mockReq.parsed.extra, mockReq.parsed.filter, mockReq.auth);
        expect(result).toEqual([{ id: 1 }]);
      });
    });

    describe('doAction', () => {
      it('should return default message', async () => {
        const result = await service.doAction(mockReq, {});
        expect(result).toBe('done nothing');
      });
    });
  });
});