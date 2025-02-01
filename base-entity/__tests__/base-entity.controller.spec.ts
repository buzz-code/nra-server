import { Test } from '@nestjs/testing';
import { BaseEntityController } from '../base-entity.controller';
import { BaseEntityService } from '../base-entity.service';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ImportFileSource } from '@shared/entities/ImportFile.entity';
import { User } from '@shared/entities/User.entity';
import { MailAddress } from '@shared/entities/MailAddress.entity';
import * as exporter from '@shared/utils/exporter/exporter.util';
import * as importer from '@shared/utils/importer/importer.util';
import { CrudRequest } from '@dataui/crud';
import { CommonFileFormat } from '@shared/utils/report/types';
import { ObjectLiteral } from '@dataui/crud-util';
import { ImportFile } from '@shared/entities/ImportFile.entity';
import * as addressparser from 'addressparser';
import { IsNotEmpty, IsOptional } from 'class-validator';

jest.mock('addressparser');

class TestEntity {
  id: number;
  @IsOptional()
  userId: number;
  @IsNotEmpty()
  field1: string;
}

interface ExtraParams {
  format?: string;
  pivot?: string;
}

const createMockCrudRequest = (extraParams: Partial<ExtraParams> = {}): CrudRequest<any, ExtraParams> => ({
  options: {},
  parsed: {
    fields: [],
    paramsFilter: [],
    authPersist: {} as ObjectLiteral,
    search: {},
    filter: [],
    or: [],
    join: [],
    sort: [],
    limit: 0,
    offset: 0,
    page: 1,
    cache: 0,
    includeDeleted: 0,
    classTransformOptions: {},
    extra: extraParams
  },
  auth: {}
}) as CrudRequest<any, ExtraParams>;

describe('BaseEntityController', () => {
  let controller: BaseEntityController<TestEntity>;
  let service: BaseEntityService<TestEntity>;
  let mockDataSource: Partial<DataSource>;
  let mockEntityManager: Partial<EntityManager>;
  let mockUserRepository: Partial<Repository<User>>;
  let mockMailAddressRepository: Partial<Repository<MailAddress>>;
  let mockImportFileRepository: Partial<Repository<ImportFile>>;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    mockUserRepository = {
      findOneOrFail: jest.fn().mockResolvedValue({
        id: 1,
        bccAddress: 'test@example.com'
      }),
    };

    mockMailAddressRepository = {
      findOneByOrFail: jest.fn().mockResolvedValue({
        userId: 1,
        alias: 'test'
      }),
    };

    mockImportFileRepository = {
      create: jest.fn().mockImplementation(data => ({
        ...data,
        id: 1
      })),
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity))
    };

    mockEntityManager = {
      getRepository: jest.fn((entity: any) => {
        if (entity === User) return mockUserRepository as Repository<User>;
        if (entity === MailAddress) return mockMailAddressRepository as Repository<MailAddress>;
        if (entity === ImportFile) return mockImportFileRepository as Repository<ImportFile>;
        return {} as Repository<any>;
      }),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockUserRepository),
      createEntityManager: jest.fn().mockReturnValue(mockEntityManager),
    };

    const mockService = {
      dataSource: mockDataSource,
      getEntityManager: jest.fn().mockReturnValue(mockEntityManager),
      getCount: jest.fn().mockResolvedValue(5),
      getDataForExport: jest.fn().mockResolvedValue([]),
      getExportHeaders: jest.fn().mockReturnValue([]),
      getName: jest.fn().mockReturnValue('test'),
      getImportDefinition: jest.fn().mockReturnValue({
        importFields: ['field1', 'field2'],
        specialFields: [],
      }),
      createMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      getReportData: jest.fn().mockResolvedValue({
        generator: 'pdf',
        params: {}
      }),
      doAction: jest.fn().mockResolvedValue({ success: true }),
      getPivotData: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        {
          provide: BaseEntityService,
          useValue: mockService,
        },
      ],
    }).compile();

    service = module.get<BaseEntityService<TestEntity>>(BaseEntityService);
    controller = new BaseEntityController<TestEntity>(service, TestEntity);
  });

  describe('getCount', () => {
    it('should return count from service', async () => {
      const req = createMockCrudRequest();
      const result = await controller.getCount(req);
      expect(result).toBe(5);
      expect(service.getCount).toHaveBeenCalledWith(req);
    });
  });

  describe('exportFile', () => {
    it('should export file with correct format', async () => {
      const mockExportFile = jest.spyOn(exporter, 'getExportedFile');
      mockExportFile.mockResolvedValue({
        data: 'test-content',
        type: 'text/csv',
        disposition: 'attachment; filename="test.csv"'
      });

      const req = createMockCrudRequest({ format: 'excel' });
      const result = await controller['exportFile'](req);
      
      expect(service.getDataForExport).toHaveBeenCalledWith(req);
      expect(service.getExportHeaders).toHaveBeenCalled();
      expect(mockExportFile).toHaveBeenCalled();
      expect(result.type).toBe('text/csv');
    });
  });

  describe('getUserIdFromMailAddress', () => {
    it('should extract user id from mail address', async () => {
      const mockAddressParser = addressparser as jest.MockedFunction<typeof addressparser>;
      mockAddressParser.mockReturnValue([
        {
          name: 'Test User',
          address: 'test@domain.com'
        }
      ]);

      const mailAddress = 'Test User <test@domain.com>';
      const result = await controller['getUserIdFromMailAddress'](mailAddress, 'domain.com');
      
      expect(result).toBe(1);
      expect(mockAddressParser).toHaveBeenCalledWith(mailAddress);
      expect(mockMailAddressRepository.findOneByOrFail).toHaveBeenCalledWith({ alias: 'test' });
    });
  });

  describe('getBccAddressFromUserId', () => {
    it('should return bcc address for valid user', async () => {
      const result = await controller['getBccAddressFromUserId'](1);
      expect(result).toBe('test@example.com');
      expect(mockUserRepository.findOneOrFail).toHaveBeenCalledWith({ 
        where: { id: 1 } 
      });
    });

    it('should return null for invalid user', async () => {
      mockUserRepository.findOneOrFail = jest.fn().mockRejectedValue(new Error('Not found'));
      const result = await controller['getBccAddressFromUserId'](999);
      expect(result).toBeNull();
    });
  });

  describe('importExcelFile', () => {
    it('should import excel file successfully', async () => {
      const mockParseExcel = jest.spyOn(importer, 'parseExcelFileAdvanced');
      mockParseExcel.mockResolvedValue([{ field1: 'value1' }]);

      const result = await controller['importExcelFile'](
        1,
        'base64data',
        'test.xlsx',
        ImportFileSource.Email
      );

      expect(mockParseExcel).toHaveBeenCalled();
      expect(service.createMany).toHaveBeenCalled();
      expect(mockImportFileRepository.create).toHaveBeenCalled();
      expect(mockImportFileRepository.save).toHaveBeenCalled();
      expect(result.fullSuccess).toBe(true);
      expect(result.response).toBe('1 רשומות נשמרו בהצלחה');
    });

    it('should handle import errors', async () => {
      const mockParseExcel = jest.spyOn(importer, 'parseExcelFileAdvanced');
      mockParseExcel.mockRejectedValue(new Error('Parse error'));

      const result = await controller['importExcelFile'](
        1,
        'base64data',
        'test.xlsx',
        ImportFileSource.Email
      );

      expect(mockImportFileRepository.create).toHaveBeenCalled();
      expect(mockImportFileRepository.save).toHaveBeenCalled();
      expect(result.fullSuccess).toBe(false);
      expect(result.response).toContain('ארעה שגיאה');
    });
  });

  describe('getPivotData', () => {
    it('should return pivot data', async () => {
      const req = createMockCrudRequest({ pivot: 'test' });
      await controller['getPivotData'](req);
      expect(service.getPivotData).toHaveBeenCalledWith(req);
    });

    it('should handle export format in pivot', async () => {
      const req = createMockCrudRequest({
        pivot: '/export?extra.format=csv',
        format: 'csv'
      });

      const mockExportFile = jest.spyOn(exporter, 'getExportedFile');
      mockExportFile.mockResolvedValue({
        data: 'test-content',
        type: 'text/csv',
        disposition: 'attachment; filename="test.csv"'
      });

      await controller['getPivotData'](req);
      
      // Cast req.parsed.extra to access its properties
      const extra = req.parsed.extra as ExtraParams;
      expect(extra.pivot).toBe('?');
      expect(extra.format).toBe('csv');
    });
  });
});