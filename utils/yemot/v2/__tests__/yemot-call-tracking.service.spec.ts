import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { YemotCallTrackingService } from '../yemot-call-tracking.service';
import { User } from '@shared/entities/User.entity';
import { YemotCall } from '@shared/entities/YemotCall.entity';
import { Call } from 'yemot-router2';

describe('YemotCallTrackingService', () => {
  let service: YemotCallTrackingService;
  let dataSource: DataSource;
  let yemotCallRepo: Repository<YemotCall>;
  let userRepo: Repository<User>;

  const mockUser = {
    id: 1,
    phoneNumber: '035586526',
    username: 'test-user',
    password: 'hashed',
    email: 'test@example.com',
    additionalData: {},
  } as unknown as User;

  const createMockCall = (overrides = {}): Partial<Call> => ({
    callId: 'test-call-123',
    did: '035586526',
    phone: '0527609942',
    ...overrides,
  });

  beforeEach(async () => {
    const mockYemotCallRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const mockUserRepo = {
      findOne: jest.fn(),
    };

    const mockDataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === YemotCall) return mockYemotCallRepo;
        if (entity === User) return mockUserRepo;
        return {};
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YemotCallTrackingService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<YemotCallTrackingService>(YemotCallTrackingService);
    dataSource = module.get<DataSource>(getDataSourceToken());
    yemotCallRepo = dataSource.getRepository(YemotCall);
    userRepo = dataSource.getRepository(User);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeCall', () => {
    it('should create new YemotCall record when call does not exist', async () => {
      const mockCall = createMockCall() as Call;
      const createdRecord = {
        id: 1,
        userId: 1,
        apiCallId: 'test-call-123',
        phone: '0527609942',
        history: [],
        currentStep: 'call_started',
        data: {
          callId: 'test-call-123',
          phone: '0527609942',
          startTime: expect.any(String),
          version: 'v2',
        },
        isOpen: true,
        hasError: false,
      };

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(yemotCallRepo, 'create').mockReturnValue(createdRecord as any);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(createdRecord as any);

      await service.initializeCall(mockCall);

      expect(yemotCallRepo.findOne).toHaveBeenCalledWith({
        where: { apiCallId: 'test-call-123' },
      });
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: '035586526' },
      });
      expect(yemotCallRepo.create).toHaveBeenCalledWith({
        userId: 1,
        user: mockUser,
        apiCallId: 'test-call-123',
        phone: '0527609942',
        history: [],
        currentStep: 'call_started',
        data: {
          callId: 'test-call-123',
          phone: '0527609942',
          startTime: expect.any(String),
          version: 'v2',
        },
        isOpen: true,
        hasError: false,
      });
      expect(yemotCallRepo.save).toHaveBeenCalledWith(createdRecord);
    });

    it('should store call in activeCalls cache', async () => {
      const mockCall = createMockCall() as Call;
      const createdRecord = {
        id: 1,
        apiCallId: 'test-call-123',
        isOpen: true,
        data: {}, // Add data object
        history: [],
      } as unknown as YemotCall;

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(yemotCallRepo, 'create').mockReturnValue(createdRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(createdRecord);

      await service.initializeCall(mockCall);

      // Verify it's in cache by finalizing the call
      await service.finalizeCall('test-call-123');
      expect(yemotCallRepo.save).toHaveBeenCalledTimes(2); // Once for init, once for finalize
    });

    it('should handle existing call and add to cache', async () => {
      const mockCall = createMockCall() as Call;
      const existingRecord = {
        id: 1,
        apiCallId: 'test-call-123',
        isOpen: true,
        history: [],
      } as unknown as YemotCall;

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);

      await service.initializeCall(mockCall);

      expect(yemotCallRepo.findOne).toHaveBeenCalledWith({
        where: { apiCallId: 'test-call-123' },
      });
      expect(yemotCallRepo.create).not.toHaveBeenCalled();
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('should handle missing user gracefully', async () => {
      const mockCall = createMockCall() as Call;

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);

      await service.initializeCall(mockCall);

      expect(userRepo.findOne).toHaveBeenCalled();
      expect(yemotCallRepo.create).not.toHaveBeenCalled();
    });

    it('should handle missing callId gracefully', async () => {
      const mockCall = createMockCall({ callId: undefined }) as Call;

      await service.initializeCall(mockCall);

      expect(yemotCallRepo.findOne).not.toHaveBeenCalled();
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('should handle missing did gracefully', async () => {
      const mockCall = createMockCall({ did: undefined }) as Call;

      await service.initializeCall(mockCall);

      expect(yemotCallRepo.findOne).not.toHaveBeenCalled();
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('should set correct initial state', async () => {
      const mockCall = createMockCall() as Call;

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(yemotCallRepo, 'create').mockReturnValue({} as any);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue({} as any);

      await service.initializeCall(mockCall);

      expect(yemotCallRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: true,
          hasError: false,
          history: [],
          currentStep: 'call_started',
        }),
      );
    });
  });

  describe('finalizeCall', () => {
    it('should mark call as closed', async () => {
      const existingRecord = {
        id: 1,
        apiCallId: 'test-call-123',
        isOpen: true,
        currentStep: 'in_progress',
        data: {},
        history: [],
      } as unknown as YemotCall;

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue({
        ...existingRecord,
        isOpen: false,
      });

      await service.finalizeCall('test-call-123');

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: false,
        }),
      );
    });

    it('should set currentStep to call_ended', async () => {
      const existingRecord = {
        id: 1,
        apiCallId: 'test-call-123',
        isOpen: true,
        currentStep: 'in_progress',
        data: {},
        history: [],
      } as unknown as YemotCall;

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);

      await service.finalizeCall('test-call-123');

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 'call_ended',
        }),
      );
    });

    it('should add endTime to data', async () => {
      const existingRecord = {
        id: 1,
        apiCallId: 'test-call-123',
        isOpen: true,
        data: { startTime: '2025-10-27T10:00:00Z' },
        history: [],
      } as unknown as YemotCall;

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);

      await service.finalizeCall('test-call-123');

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endTime: expect.any(String),
          }),
        }),
      );
    });

    it('should remove call from activeCalls cache', async () => {
      const mockCall = createMockCall() as Call;
      const createdRecord = {
        id: 1,
        apiCallId: 'test-call-123',
        isOpen: true,
        history: [],
        data: {},
      } as unknown as YemotCall;

      // First initialize to add to cache
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(yemotCallRepo, 'create').mockReturnValue(createdRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(createdRecord);

      await service.initializeCall(mockCall);

      // Now finalize
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(createdRecord);
      await service.finalizeCall('test-call-123');

      // Try to finalize again - should query DB since not in cache
      jest.clearAllMocks();
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(createdRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(createdRecord);
      
      await service.finalizeCall('test-call-123');
      expect(yemotCallRepo.findOne).toHaveBeenCalled();
    });

    it('should handle missing call gracefully', async () => {
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(null);

      await expect(service.finalizeCall('non-existent')).resolves.not.toThrow();

      expect(yemotCallRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('logConversationStep', () => {
    const existingRecord = {
      id: 1,
      apiCallId: 'test-call-123',
      isOpen: true,
      currentStep: 'in_progress',
      data: {},
      history: [],
    } as unknown as YemotCall;

    beforeEach(() => {
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);
    });

    it('should add step to history array', async () => {
      await service.logConversationStep('test-call-123', 'Test prompt', 'User response');

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.arrayContaining([
            expect.objectContaining({
              params: expect.objectContaining({
                prompt: 'Test prompt',
                userResponse: 'User response',
              }),
              response: 'User response',
            }),
          ]),
        }),
      );
    });

    it('should update currentStep', async () => {
      await service.logConversationStep('test-call-123', 'Test prompt', 'User response', 'menu_selection');

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 'menu_selection',
        }),
      );
    });

    it('should store lastResponse and lastPrompt in data', async () => {
      await service.logConversationStep('test-call-123', 'What is your name?', 'John');

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastResponse: 'John',
            lastPrompt: 'What is your name?',
          }),
        }),
      );
    });

    it('should log prompt-only steps with waiting_for_input', async () => {
      await service.logConversationStep('test-call-123', 'Enter your choice', undefined, 'ask_input');

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.arrayContaining([
            expect.objectContaining({
              params: expect.objectContaining({
                prompt: 'Enter your choice',
                stepType: 'ask_input',
              }),
              response: 'waiting_for_input',
            }),
          ]),
        }),
      );
    });

    it('should handle different stepTypes', async () => {
      const stepTypes = ['ask_input', 'user_input', 'menu_selection', 'confirmation_result', 'hangup_message'];

      for (const stepType of stepTypes) {
        jest.clearAllMocks();
        jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue({ ...existingRecord, history: [] });
        jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);

        await service.logConversationStep('test-call-123', 'Test', 'Response', stepType);

        expect(yemotCallRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            currentStep: stepType,
            history: expect.arrayContaining([
              expect.objectContaining({
                params: expect.objectContaining({
                  stepType,
                }),
              }),
            ]),
          }),
        );
      }
    });

    it('should handle missing call gracefully', async () => {
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.logConversationStep('non-existent', 'Test', 'Response'),
      ).resolves.not.toThrow();

      expect(yemotCallRepo.save).not.toHaveBeenCalled();
    });

    it('should not update lastResponse/lastPrompt if no userResponse', async () => {
      const recordWithData = { ...existingRecord, data: { existing: 'data' } };
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(recordWithData);

      await service.logConversationStep('test-call-123', 'Prompt only', undefined);

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            lastResponse: expect.anything(),
            lastPrompt: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('markCallError', () => {
    const existingRecord = {
      id: 1,
      apiCallId: 'test-call-123',
      isOpen: true,
      hasError: false,
      data: {},
      history: [],
    } as unknown as YemotCall;

    it('should set hasError to true', async () => {
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);

      const error = new Error('Test error');
      await service.markCallError('test-call-123', error);

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hasError: true,
        }),
      );
    });

    it('should store errorMessage', async () => {
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);

      const error = new Error('Something went wrong');
      await service.markCallError('test-call-123', error);

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Something went wrong',
        }),
      );
    });

    it('should log error as conversation step', async () => {
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);

      const error = new Error('Fatal error');
      await service.markCallError('test-call-123', error);

      expect(yemotCallRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.arrayContaining([
            expect.objectContaining({
              params: expect.objectContaining({
                prompt: 'Error occurred',
                stepType: 'error',
                userResponse: 'Fatal error',
              }),
            }),
          ]),
        }),
      );
    });

    it('should handle missing call gracefully', async () => {
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(null);

      const error = new Error('Test error');
      await expect(service.markCallError('non-existent', error)).resolves.not.toThrow();
    });
  });

  describe('Cache behavior (findActiveCall)', () => {
    it('should return from cache if available', async () => {
      const mockCall = createMockCall() as Call;
      const createdRecord = {
        id: 1,
        apiCallId: 'test-call-123',
        isOpen: true,
        history: [],
        data: {},
      } as unknown as YemotCall;

      // Initialize to add to cache
      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(yemotCallRepo, 'create').mockReturnValue(createdRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(createdRecord);

      await service.initializeCall(mockCall);

      // Clear mocks to verify cache usage
      jest.clearAllMocks();
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(createdRecord);

      // Log conversation step - should use cache, not query DB
      await service.logConversationStep('test-call-123', 'Test', 'Response');

      expect(yemotCallRepo.findOne).not.toHaveBeenCalled();
      expect(yemotCallRepo.save).toHaveBeenCalled();
    });

    it('should query database if not in cache', async () => {
      const existingRecord = {
        id: 1,
        apiCallId: 'test-call-123',
        isOpen: true,
        history: [],
        data: {},
      } as unknown as YemotCall;

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);

      // Log conversation step without initialization - should query DB
      await service.logConversationStep('test-call-123', 'Test', 'Response');

      expect(yemotCallRepo.findOne).toHaveBeenCalledWith({
        where: { apiCallId: 'test-call-123' },
      });
    });

    it('should add to cache after database retrieval', async () => {
      const existingRecord = {
        id: 1,
        apiCallId: 'test-call-123',
        isOpen: true,
        history: [],
        data: {},
      } as unknown as YemotCall;

      jest.spyOn(yemotCallRepo, 'findOne').mockResolvedValue(existingRecord);
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);

      // First call - queries DB
      await service.logConversationStep('test-call-123', 'Test 1', 'Response 1');
      expect(yemotCallRepo.findOne).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      jest.clearAllMocks();
      jest.spyOn(yemotCallRepo, 'save').mockResolvedValue(existingRecord);
      await service.logConversationStep('test-call-123', 'Test 2', 'Response 2');
      expect(yemotCallRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
