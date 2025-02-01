import { Test, TestingModule } from '@nestjs/testing';
import { BaseEntityService } from '../base-entity.service';
import { Repository, DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { MailSendService } from '@shared/utils/mail/mail-send.service';
import { CrudRequest } from '@dataui/crud';
import { TypeOrmCrudService } from '@dataui/crud-typeorm';
import { validateNotTrialEnded } from '../base-entity.util';
import { ENTITY_EXPORTER, ENTITY_REPOSITORY } from '../interface';

jest.mock('../base-entity.util', () => ({
  validateNotTrialEnded: jest.fn().mockResolvedValue(undefined),
}));

describe('BaseEntityService', () => {
  let service: BaseEntityService<any>;
  let repository: Repository<any>;
  let dataSource: DataSource;
  let mailService: MailSendService;
  let entityColumns: string[];
  let mockDto: { name: string; userId?: number };

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
          useValue: {
            transaction: jest.fn((cb) => cb()),
          }
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

    // Reset mockDto for each test
    mockDto = { name: 'test' };

    // Set default columns and configure getter
    entityColumns = ['id', 'name'];
    Object.defineProperty(service, 'entityColumns', {
      get: () => entityColumns,
      configurable: true
    });

    jest.clearAllMocks();
    // Reset validateNotTrialEnded mock
    (validateNotTrialEnded as jest.Mock).mockResolvedValue(undefined);
    // Mock super.createOne by default
    jest.spyOn(TypeOrmCrudService.prototype, 'createOne').mockResolvedValue({ id: 1, ...mockDto });
    // Mock super.createMany by default
    jest.spyOn(TypeOrmCrudService.prototype, 'createMany').mockResolvedValue([{ id: 1, ...mockDto }]);
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

    it('should get entity manager', () => {
      const result = service.getEntityManager();
      expect(result).toBeDefined();
      expect(result).toBe(repository.manager);
    });
  });

  describe('CRUD Operations', () => {
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

      it('should handle createOne failure', async () => {
        const error = new Error('Database error');
        jest.spyOn(TypeOrmCrudService.prototype, 'createOne').mockRejectedValue(error);
        
        await expect(service.createOne(mockReq, mockDto)).rejects.toThrow('Database error');
      });

      it('should handle createMany failure', async () => {
        const error = new Error('Bulk insert failed');
        jest.spyOn(TypeOrmCrudService.prototype, 'createMany').mockRejectedValue(error);
        
        await expect(service.createMany(mockReq, { bulk: [mockDto] })).rejects.toThrow('Bulk insert failed');
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

      it('should handle getCount failure', async () => {
        const mockBuilder = {
          getCount: jest.fn().mockRejectedValue(new Error('Count failed')),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis()
        } as unknown as SelectQueryBuilder<any>;

        jest.spyOn(service as any, 'createBuilder').mockResolvedValue(mockBuilder);

        await expect(service.getCount(mockReq)).rejects.toThrow('Count failed');
      });
    });
  });

  describe('User Data Injection', () => {
    describe('with userId column', () => {
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

      it('should handle trial ended validation failure', async () => {
        (validateNotTrialEnded as jest.Mock).mockRejectedValue(new Error('Trial ended'));
        await expect(service.createOne(mockReq, mockDto)).rejects.toThrow('Trial ended');
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

      it('should not override existing userId', async () => {
        const dtoCopy = { ...mockDto, userId: 456 };
        await service.createOne(mockReq, dtoCopy);
        expect(dtoCopy.userId).toBe(456);
      });
    });

    describe('without userId column', () => {
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
    
      describe('Export/Import Operations', () => {
        describe('getDataForExport', () => {
          it('should call processReqForExport when defined', async () => {
            const mockProcessReqForExport = jest.fn();
            const mockExportDefinition = {
              processReqForExport: mockProcessReqForExport
            };
            Object.defineProperty(service, 'exportDefinition', {
              get: () => mockExportDefinition
            });
    
            await service.getDataForExport(mockReq);
            expect(mockProcessReqForExport).toHaveBeenCalled();
          });
    
          it('should call getDataForExportInner directly when processReqForExport not defined', async () => {
            const mockData = [{ id: 1, name: 'test' }];
            jest.spyOn(service as any, 'getDataForExportInner').mockResolvedValue(mockData);
            
            const result = await service.getDataForExport(mockReq);
            expect(result).toEqual(mockData);
          });
        });
    
        describe('getExportHeaders', () => {
          it('should use custom headers when defined', () => {
            const customHeaders = [{ key: 'name', label: 'Name' }];
            const mockExportDefinition = {
              getExportHeaders: jest.fn().mockReturnValue(customHeaders)
            };
            Object.defineProperty(service, 'exportDefinition', {
              get: () => mockExportDefinition
            });
    
            const result = service.getExportHeaders(mockReq, []);
            expect(result).toEqual(customHeaders);
          });
    
          it('should use entity columns when custom headers not defined', () => {
            const result = service.getExportHeaders(mockReq, []);
            expect(result).toEqual(entityColumns);
          });
    
          it('should include pivot headers when pivot data present', () => {
            const pivotData = [{
              headers: [{ key: 'pivotCol', label: 'Pivot Column' }]
            }];
            const reqWithPivot = {
              ...mockReq,
              parsed: {
                ...mockReq.parsed,
                extra: { pivot: 'TestPivot' }
              }
            };
    
            const result = service.getExportHeaders(reqWithPivot, pivotData);
            expect(result).toEqual([
              ...entityColumns,
              { key: 'pivotCol', label: 'Pivot Column' }
            ]);
          });
        });
    
        describe('getImportDefinition', () => {
          it('should use custom import definition when defined', () => {
            const customImportDef = { importFields: ['name'] };
            const mockExportDefinition = {
              getImportDefinition: jest.fn().mockReturnValue(customImportDef)
            };
            Object.defineProperty(service, 'exportDefinition', {
              get: () => mockExportDefinition
            });
    
            const result = service.getImportDefinition();
            expect(result).toEqual(customImportDef);
          });
    
          it('should generate default import definition when custom not defined', () => {
            entityColumns = ['id', 'name', 'userId', 'createdAt', 'updatedAt', 'description'];
            const result = service.getImportDefinition();
            expect(result.importFields).toEqual(['name', 'description']);
          });
        });
      });
    
      describe('Report and Action Operations', () => {
        describe('getReportData', () => {
          it('should return report data with generator and params', async () => {
            const result = await service.getReportData(mockReq);
            expect(result).toHaveProperty('generator');
            expect(result).toHaveProperty('params', mockReq.parsed.extra);
            expect(result.generator.constructor.name).toBe('ParamsToJsonReportGenerator');
          });
        });
    
        describe('doAction', () => {
          it('should return default response', async () => {
            const result = await service.doAction(mockReq, {});
            expect(result).toBe('done nothing');
          });
        });
      });
    
      describe('Pivot Operations', () => {
        describe('getPivotData', () => {
          it('should get and populate pivot data when records exist', async () => {
            const mockData = {
              data: [{ id: 1, name: 'test' }],
              count: 1,
              total: 1,
              page: 1,
              pageCount: 1
            };
            jest.spyOn(service, 'getMany').mockResolvedValue(mockData);
            jest.spyOn(service as any, 'populatePivotData').mockResolvedValue(undefined);
    
            const reqWithPivot = {
              ...mockReq,
              parsed: {
                ...mockReq.parsed,
                extra: { pivot: '?TestPivot' }
              }
            };
    
            await service.getPivotData(reqWithPivot);
            expect(service['populatePivotData']).toHaveBeenCalledWith(
              'TestPivot',
              mockData.data,
              reqWithPivot.parsed.extra,
              reqWithPivot.parsed.filter,
              reqWithPivot.auth
            );
          });
    
          it('should handle empty results', async () => {
            const mockData = {
              data: [],
              count: 0,
              total: 0,
              page: 1,
              pageCount: 0
            };
            jest.spyOn(service, 'getMany').mockResolvedValue(mockData);
            const populateSpy = jest.spyOn(service as any, 'populatePivotData');
    
            const reqWithPivot = {
              ...mockReq,
              parsed: {
                ...mockReq.parsed,
                extra: { pivot: '?TestPivot' }
              }
            };
    
            const result = await service.getPivotData(reqWithPivot);
            expect(populateSpy).not.toHaveBeenCalled();
            expect(result).toEqual(mockData);
          });
    
          it('should handle array response from getMany', async () => {
            const mockData = [{ id: 1, name: 'test' }];
            jest.spyOn(service, 'getMany').mockResolvedValue(mockData);
            jest.spyOn(service as any, 'populatePivotData').mockResolvedValue(undefined);
    
            const reqWithPivot = {
              ...mockReq,
              parsed: {
                ...mockReq.parsed,
                extra: { pivot: '?TestPivot' }
              }
            };
    
            const result = await service.getPivotData(reqWithPivot);
            expect(service['populatePivotData']).toHaveBeenCalled();
            expect(result).toEqual(mockData);
          });
        });
    
        describe('populatePivotData', () => {
          it('should do nothing by default', async () => {
            const result = await service['populatePivotData']('test', [], {}, [], {});
            expect(result).toBeUndefined();
          });
        });
      });
    });
  });
});
