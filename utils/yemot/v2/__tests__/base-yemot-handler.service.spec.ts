import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BaseYemotHandlerService } from '../yemot-router.service';
import { YemotCallTrackingService } from '../yemot-call-tracking.service';
import { User } from '@shared/entities/User.entity';
import { TextByUser } from '@shared/view-entities/TextByUser.entity';
import { Call, TapOptions } from 'yemot-router2';

// Create a concrete test class extending BaseYemotHandlerService
class TestYemotHandler extends BaseYemotHandlerService {
  async processCall() {
    // Test implementation
  }

  // Expose protected methods for testing
  public async testGetUserByDidPhone() {
    return this.getUserByDidPhone();
  }

  public async testGetTextDataByUserId(textKey: string, values?: Record<string, string | number>) {
    return this.getTextDataByUserId(textKey, values);
  }

  public async testGetTextByUserId(textKey: string, values?: Record<string, string | number>) {
    return this.getTextByUserId(textKey, values);
  }

  public testHangupWithMessage(message: string) {
    return this.hangupWithMessage(message);
  }

  public async testAskForInput(message: string, options?: TapOptions) {
    return this.askForInput(message, options);
  }

  public testSendMessage(message: string) {
    return this.sendMessage(message);
  }

  public async testHangupWithMessageByKey(textKey: string, values?: Record<string, string | number>) {
    return this.hangupWithMessageByKey(textKey, values);
  }

  public async testAskForInputByKey(textKey: string, values?: Record<string, string | number>, options?: TapOptions) {
    return this.askForInputByKey(textKey, values, options);
  }

  public async testSendMessageByKey(textKey: string, values?: Record<string, string | number>) {
    return this.sendMessageByKey(textKey, values);
  }

  public async testAskForMenu<T extends { key: string | number; name: string }>(textKey: string, options: T[]) {
    return this.askForMenu(textKey, options);
  }

  public async testAskConfirmation(
    textKey: string,
    values: Record<string, string | number> = {},
    yesTextKey?: string,
    noTextKey?: string,
    yesValue = '1',
    noValue = '2',
  ) {
    return this.askConfirmation(textKey, values, yesTextKey, noTextKey, yesValue, noValue);
  }

  // Expose user property for testing
  public getUser() {
    return this.user;
  }

  public setUser(user: User) {
    this.user = user;
  }
}

describe('BaseYemotHandlerService', () => {
  let handler: TestYemotHandler;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let textByUserRepo: Repository<TextByUser>;
  let mockCall: Partial<Call>;
  let mockCallTracker: YemotCallTrackingService;

  const mockUser = {
    id: 1,
    phoneNumber: '035586526',
    username: 'test-user',
  } as unknown as User;

  const createMockCall = (overrides = {}): Partial<Call> => ({
    callId: 'test-call-123',
    did: '035586526',
    phone: '0527609942',
    read: jest.fn(),
    id_list_message: jest.fn(),
    hangup: jest.fn(),
    ...overrides,
  });

  beforeEach(async () => {
    mockCall = createMockCall();

    const mockUserRepo = {
      findOne: jest.fn(),
    };

    const mockTextByUserRepo = {
      findOne: jest.fn(),
    };

    const mockDataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === User) return mockUserRepo;
        if (entity === TextByUser) return mockTextByUserRepo;
        return {};
      }),
    };

    mockCallTracker = {
      logConversationStep: jest.fn().mockResolvedValue(undefined),
      initializeCall: jest.fn().mockResolvedValue(undefined),
      finalizeCall: jest.fn().mockResolvedValue(undefined),
      markCallError: jest.fn().mockResolvedValue(undefined),
    } as unknown as YemotCallTrackingService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    dataSource = module.get<DataSource>(getDataSourceToken());
    userRepo = dataSource.getRepository(User);
    textByUserRepo = dataSource.getRepository(TextByUser);

    handler = new TestYemotHandler(dataSource, mockCall as Call, mockCallTracker);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserByDidPhone', () => {
    it('should find user by did phone number', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);

      await handler.testGetUserByDidPhone();

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: '035586526' },
      });
    });

    it('should set this.user', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);

      await handler.testGetUserByDidPhone();

      expect(handler.getUser()).toEqual(mockUser);
    });

    it('should hang up with error message if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);

      await handler.testGetUserByDidPhone();

      expect(mockCall.hangup).toHaveBeenCalled();
      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        [{ type: 'text', data: 'המערכת לא מחוברת, אנא פני למזכירות' }],
        { prependToNextAction: true },
      );
    });

    it('should log retrieval attempt', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);

      await handler.testGetUserByDidPhone();

      // The logger is called internally, we just verify no errors
      expect(userRepo.findOne).toHaveBeenCalled();
    });
  });

  describe('getTextDataByUserId', () => {
    it('should retrieve text from TextByUser repository', async () => {
      handler.setUser(mockUser);
      const mockText = {
        userId: 1,
        name: 'TEST.KEY',
        value: 'Test value',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      const result = await handler.testGetTextDataByUserId('TEST.KEY');

      expect(textByUserRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 1, name: 'TEST.KEY' },
        cache: true,
      });
      expect(result).toEqual({ value: 'Test value', filepath: null });
    });

    it('should return value and filepath', async () => {
      handler.setUser(mockUser);
      const mockText = {
        value: 'Audio message',
        filepath: '/path/to/audio.wav',
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      const result = await handler.testGetTextDataByUserId('TEST.KEY');

      expect(result.value).toBe('Audio message');
      expect(result.filepath).toBe('/path/to/audio.wav');
    });

    it('should return textKey as fallback if not found', async () => {
      handler.setUser(mockUser);
      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(null);

      const result = await handler.testGetTextDataByUserId('MISSING.KEY');

      expect(result.value).toBe('MISSING.KEY');
      expect(result.filepath).toBe(null);
    });

    it('should replace {placeholders} with provided values', async () => {
      handler.setUser(mockUser);
      const mockText = {
        value: 'Hello {name}, your score is {score}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      const result = await handler.testGetTextDataByUserId('TEST.KEY', { name: 'John', score: 95 });

      expect(result.value).toBe('Hello John, your score is 95');
    });

    it('should handle multiple placeholders correctly', async () => {
      handler.setUser(mockUser);
      const mockText = {
        value: '{greeting} {name}, {question}? {yes} or {no}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      const result = await handler.testGetTextDataByUserId('TEST.KEY', {
        greeting: 'שלום',
        name: 'מורה',
        question: 'האם אתה מאשר',
        yes: 'כן',
        no: 'לא',
      });

      expect(result.value).toBe('שלום מורה, האם אתה מאשר? כן or לא');
    });

    it('should use cache for repeated queries', async () => {
      handler.setUser(mockUser);
      const mockText = {
        value: 'Cached value',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      await handler.testGetTextDataByUserId('TEST.KEY');

      expect(textByUserRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ cache: true }),
      );
    });
  });

  describe('getTextByUserId', () => {
    it('should call getTextDataByUserId', async () => {
      handler.setUser(mockUser);
      const mockText = {
        value: 'Test value',
        filepath: '/path/to/file',
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      await handler.testGetTextByUserId('TEST.KEY');

      expect(textByUserRepo.findOne).toHaveBeenCalled();
    });

    it('should return only the value (not filepath)', async () => {
      handler.setUser(mockUser);
      const mockText = {
        value: 'Just the text',
        filepath: '/some/file.wav',
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      const result = await handler.testGetTextByUserId('TEST.KEY');

      expect(result).toBe('Just the text');
      expect(result).not.toContain('/some/file.wav');
    });
  });

  describe('hangupWithMessage', () => {
    it('should log conversation step with stepType: hangup_message', async () => {
      handler.testHangupWithMessage('Goodbye');

      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        'Goodbye',
        undefined,
        'hangup_message',
      );
    });

    it('should send message via call.id_list_message()', () => {
      handler.testHangupWithMessage('Test message');

      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        [{ type: 'text', data: 'Test message' }],
        { prependToNextAction: true },
      );
    });

    it('should call call.hangup()', () => {
      handler.testHangupWithMessage('Ending call');

      expect(mockCall.hangup).toHaveBeenCalled();
    });

    it('should use prependToNextAction: true', () => {
      handler.testHangupWithMessage('Message');

      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        expect.anything(),
        { prependToNextAction: true },
      );
    });
  });

  describe('askForInput', () => {
    it('should log conversation step (ask_input)', async () => {
      (mockCall.read as jest.Mock).mockResolvedValue('1');

      await handler.testAskForInput('Enter choice');

      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        'Enter choice',
        undefined,
        'ask_input',
      );
    });

    it('should call call.read() with text message', async () => {
      (mockCall.read as jest.Mock).mockResolvedValue('2');

      await handler.testAskForInput('Your answer?');

      expect(mockCall.read).toHaveBeenCalledWith(
        [{ type: 'text', data: 'Your answer?' }],
        'tap',
        undefined,
      );
    });

    it('should log user response (user_input)', async () => {
      (mockCall.read as jest.Mock).mockResolvedValue('3');

      await handler.testAskForInput('Question');

      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        'Question',
        '3',
        'user_input',
      );
    });

    it('should return user input', async () => {
      (mockCall.read as jest.Mock).mockResolvedValue('42');

      const result = await handler.testAskForInput('Enter number');

      expect(result).toBe('42');
    });

    it('should pass TapOptions to call.read()', async () => {
      (mockCall.read as jest.Mock).mockResolvedValue('1');
      const options: TapOptions = { min_digits: 1, max_digits: 3 };

      await handler.testAskForInput('Enter', options);

      expect(mockCall.read).toHaveBeenCalledWith(
        expect.anything(),
        'tap',
        options,
      );
    });
  });

  describe('sendMessage', () => {
    it('should log conversation step (send_message)', () => {
      handler.testSendMessage('Info message');

      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        'Info message',
        undefined,
        'send_message',
      );
    });

    it('should call call.id_list_message()', () => {
      handler.testSendMessage('Notification');

      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        [{ type: 'text', data: 'Notification' }],
        { prependToNextAction: true },
      );
    });

    it('should use prependToNextAction: true', () => {
      handler.testSendMessage('Message');

      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        expect.anything(),
        { prependToNextAction: true },
      );
    });
  });

  describe('hangupWithMessageByKey', () => {
    beforeEach(() => {
      handler.setUser(mockUser);
    });

    it('should retrieve text message by key', async () => {
      const mockText = {
        value: 'Goodbye message',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      await handler.testHangupWithMessageByKey('GOODBYE.MESSAGE');

      expect(textByUserRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, name: 'GOODBYE.MESSAGE' } }),
      );
    });

    it('should handle text messages', async () => {
      const mockText = {
        value: 'Text goodbye',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      await handler.testHangupWithMessageByKey('TEST.KEY');

      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        [{ type: 'text', data: 'Text goodbye' }],
        { prependToNextAction: true },
      );
    });

    it('should handle file messages', async () => {
      const mockText = {
        value: 'File description',
        filepath: '/audio/goodbye.wav',
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      await handler.testHangupWithMessageByKey('TEST.KEY');

      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        [{ type: 'file', data: '/audio/goodbye.wav' }],
        { prependToNextAction: true },
      );
    });

    it('should log with appropriate message text', async () => {
      const mockText = {
        value: 'Logged message',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      await handler.testHangupWithMessageByKey('TEST.KEY');

      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        'Logged message',
        undefined,
        'hangup_message',
      );
    });

    it('should call hangup', async () => {
      const mockText = {
        value: 'Goodbye',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      await handler.testHangupWithMessageByKey('TEST.KEY');

      expect(mockCall.hangup).toHaveBeenCalled();
    });
  });

  describe('askForInputByKey', () => {
    beforeEach(() => {
      handler.setUser(mockUser);
    });

    it('should retrieve message by key (text or file)', async () => {
      const mockText = {
        value: 'Enter your choice',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('1');

      await handler.testAskForInputByKey('PROMPT.KEY');

      expect(textByUserRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, name: 'PROMPT.KEY' } }),
      );
    });

    it('should log conversation steps correctly', async () => {
      const mockText = {
        value: 'Question text',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('2');

      await handler.testAskForInputByKey('TEST.KEY');

      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        'Question text',
        undefined,
        'ask_input',
      );
      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        'Question text',
        '2',
        'user_input',
      );
    });

    it('should handle file-based prompts', async () => {
      const mockText = {
        value: 'File description',
        filepath: '/audio/question.wav',
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('1');

      await handler.testAskForInputByKey('TEST.KEY');

      expect(mockCall.read).toHaveBeenCalledWith(
        [{ type: 'file', data: '/audio/question.wav' }],
        'tap',
        undefined,
      );
    });

    it('should pass options to call.read()', async () => {
      const mockText = {
        value: 'Enter digits',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('123');

      const options: TapOptions = { min_digits: 3, max_digits: 3 };
      await handler.testAskForInputByKey('TEST.KEY', undefined, options);

      expect(mockCall.read).toHaveBeenCalledWith(
        expect.anything(),
        'tap',
        options,
      );
    });
  });

  describe('sendMessageByKey', () => {
    beforeEach(() => {
      handler.setUser(mockUser);
    });

    it('should retrieve and send message by key', async () => {
      const mockText = {
        value: 'Info message',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      await handler.testSendMessageByKey('INFO.KEY');

      expect(textByUserRepo.findOne).toHaveBeenCalled();
      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        [{ type: 'text', data: 'Info message' }],
        { prependToNextAction: true },
      );
    });

    it('should handle both text and file types', async () => {
      // Test text
      const textMessage = {
        value: 'Text message',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(textMessage);
      await handler.testSendMessageByKey('TEXT.KEY');

      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        [{ type: 'text', data: 'Text message' }],
        expect.anything(),
      );

      // Test file
      const fileMessage = {
        value: 'File description',
        filepath: '/audio/message.wav',
      } as unknown as TextByUser;

      jest.clearAllMocks();
      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(fileMessage);
      await handler.testSendMessageByKey('FILE.KEY');

      expect(mockCall.id_list_message).toHaveBeenCalledWith(
        [{ type: 'file', data: '/audio/message.wav' }],
        expect.anything(),
      );
    });

    it('should log correctly', async () => {
      const mockText = {
        value: 'Logged message',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      await handler.testSendMessageByKey('TEST.KEY');

      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        'Logged message',
        undefined,
        'send_message',
      );
    });
  });

  describe('askForMenu', () => {
    beforeEach(() => {
      handler.setUser(mockUser);
    });

    it('should format menu options (key - name)', async () => {
      const mockText = {
        value: 'בחר אפשרות: {options}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('1');

      const options = [
        { key: '1', name: 'אפשרות 1' },
        { key: '2', name: 'אפשרות 2' },
      ];

      await handler.testAskForMenu('MENU.KEY', options);

      expect(mockCall.read).toHaveBeenCalledWith(
        expect.anything(),
        'tap',
        expect.objectContaining({
          digits_allowed: ['1', '2'],
        }),
      );
    });

    it('should calculate correct max_digits from options', async () => {
      const mockText = {
        value: 'Select: {options}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('10');

      const options = [
        { key: '1', name: 'One' },
        { key: '10', name: 'Ten' },
        { key: '100', name: 'Hundred' },
      ];

      await handler.testAskForMenu('MENU.KEY', options);

      expect(mockCall.read).toHaveBeenCalledWith(
        expect.anything(),
        'tap',
        expect.objectContaining({
          max_digits: 3, // Length of '100'
        }),
      );
    });

    it('should set digits_allowed to option keys', async () => {
      const mockText = {
        value: 'Choose: {options}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('3');

      const options = [
        { key: 1, name: 'First' },
        { key: 2, name: 'Second' },
        { key: 3, name: 'Third' },
      ];

      await handler.testAskForMenu('MENU.KEY', options);

      expect(mockCall.read).toHaveBeenCalledWith(
        expect.anything(),
        'tap',
        expect.objectContaining({
          digits_allowed: ['1', '2', '3'],
        }),
      );
    });

    it('should find and return selected option', async () => {
      const mockText = {
        value: 'Select: {options}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('2');

      const options = [
        { key: '1', name: 'Option A' },
        { key: '2', name: 'Option B' },
        { key: '3', name: 'Option C' },
      ];

      const result = await handler.testAskForMenu('MENU.KEY', options);

      expect(result).toEqual({ key: '2', name: 'Option B' });
    });

    it('should log menu prompt and user selection', async () => {
      const mockText = {
        value: 'בחר: {options}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('1');

      const options = [
        { key: '1', name: 'כן' },
        { key: '2', name: 'לא' },
      ];

      await handler.testAskForMenu('MENU.KEY', options);

      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        expect.stringContaining('בחר'),
        '1 (כן)',
        'menu_selection',
      );
    });

    it('should handle unknown selection gracefully', async () => {
      const mockText = {
        value: 'Select: {options}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('999');

      const options = [
        { key: '1', name: 'Option A' },
        { key: '2', name: 'Option B' },
      ];

      const result = await handler.testAskForMenu('MENU.KEY', options);

      expect(result).toBeUndefined();
      expect(mockCallTracker.logConversationStep).toHaveBeenCalledWith(
        'test-call-123',
        expect.anything(),
        '999 (unknown)',
        'menu_selection',
      );
    });
  });

  describe('askConfirmation', () => {
    beforeEach(() => {
      handler.setUser(mockUser);
    });

    it('should get yes/no text from translation system', async () => {
      const mockConfirmText = {
        value: 'האם אתה בטוח? {yes}, {no}',
        filepath: null,
      } as unknown as TextByUser;

      const mockYesText = {
        value: 'לאישור הקישי 1',
        filepath: null,
      } as unknown as TextByUser;

      const mockNoText = {
        value: 'לשינוי הקישי 2',
        filepath: null,
      } as unknown as TextByUser;

      jest
        .spyOn(textByUserRepo, 'findOne')
        .mockImplementation(async (options: any) => {
          if (options.where.name === 'CONFIRM.KEY') return mockConfirmText;
          if (options.where.name === 'GENERAL.YES') return mockYesText;
          if (options.where.name === 'GENERAL.NO') return mockNoText;
          return null;
        });

      (mockCall.read as jest.Mock).mockResolvedValue('1');

      await handler.testAskConfirmation('CONFIRM.KEY');

      expect(textByUserRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, name: 'GENERAL.YES' } }),
      );
      expect(textByUserRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, name: 'GENERAL.NO' } }),
      );
    });

    it('should build confirmation prompt with values', async () => {
      const mockText = {
        value: 'האם אתה בטוח? {yes}, {no}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('1');

      await handler.testAskConfirmation('CONFIRM.KEY');

      expect(mockCall.read).toHaveBeenCalled();
    });

    it('should accept only yesValue and noValue (default 1/2)', async () => {
      const mockText = {
        value: 'Confirm? {yes}, {no}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('1');

      await handler.testAskConfirmation('CONFIRM.KEY');

      expect(mockCall.read).toHaveBeenCalledWith(
        expect.anything(),
        'tap',
        expect.objectContaining({
          min_digits: 1,
          max_digits: 1,
          digits_allowed: ['1', '2'],
        }),
      );
    });

    it('should return true for yes, false for no', async () => {
      const mockText = {
        value: 'Confirm? {yes}, {no}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);

      // Test yes
      (mockCall.read as jest.Mock).mockResolvedValue('1');
      const yesResult = await handler.testAskConfirmation('CONFIRM.KEY');
      expect(yesResult).toBe(true);

      // Test no
      (mockCall.read as jest.Mock).mockResolvedValue('2');
      const noResult = await handler.testAskConfirmation('CONFIRM.KEY');
      expect(noResult).toBe(false);
    });

    it('should log confirmation prompt and result', async () => {
      const mockYesText = {
        value: 'לאישור הקישי 1',
        filepath: null,
      } as unknown as TextByUser;

      const mockNoText = {
        value: 'לשינוי הקישי 2',
        filepath: null,
      } as unknown as TextByUser;

      const mockConfirmText = {
        value: 'אישור? {yes}, {no}',
        filepath: null,
      } as unknown as TextByUser;

      jest
        .spyOn(textByUserRepo, 'findOne')
        .mockImplementation(async (options: any) => {
          if (options.where.name === 'GENERAL.YES') return mockYesText;
          if (options.where.name === 'GENERAL.NO') return mockNoText;
          return mockConfirmText;
        });

      (mockCall.read as jest.Mock).mockResolvedValue('1');

      await handler.testAskConfirmation('CONFIRM.KEY');

      // Check that logging was called with ask_confirmation
      const askConfirmationCall = (mockCallTracker.logConversationStep as jest.Mock).mock.calls.find(
        call => call[3] === 'ask_confirmation'
      );
      expect(askConfirmationCall).toBeDefined();
      expect(askConfirmationCall[0]).toBe('test-call-123');
      expect(askConfirmationCall[1]).toContain('אישור');

      // Check that logging was called with confirmation_result
      const confirmationResultCall = (mockCallTracker.logConversationStep as jest.Mock).mock.calls.find(
        call => call[3] === 'confirmation_result'
      );
      expect(confirmationResultCall).toBeDefined();
      expect(confirmationResultCall[2]).toMatch(/1 \(.+\)/);
    });

    it('should support custom yes/no text keys', async () => {
      const mockText = {
        value: 'Custom confirm? {yes}, {no}',
        filepath: null,
      } as unknown as TextByUser;

      jest
        .spyOn(textByUserRepo, 'findOne')
        .mockImplementation(async (options: any) => {
          if (options.where.name === 'CUSTOM.YES') return { value: 'כן כן', filepath: null } as unknown as TextByUser;
          if (options.where.name === 'CUSTOM.NO') return { value: 'לא לא', filepath: null } as unknown as TextByUser;
          return mockText;
        });

      (mockCall.read as jest.Mock).mockResolvedValue('1');

      await handler.testAskConfirmation('CONFIRM.KEY', {}, 'CUSTOM.YES', 'CUSTOM.NO');

      expect(textByUserRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, name: 'CUSTOM.YES' } }),
      );
      expect(textByUserRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, name: 'CUSTOM.NO' } }),
      );
    });

    it('should support custom yes/no values', async () => {
      const mockText = {
        value: 'Confirm? {yes}, {no}',
        filepath: null,
      } as unknown as TextByUser;

      jest.spyOn(textByUserRepo, 'findOne').mockResolvedValue(mockText);
      (mockCall.read as jest.Mock).mockResolvedValue('9');

      await handler.testAskConfirmation('CONFIRM.KEY', {}, undefined, undefined, '9', '0');

      expect(mockCall.read).toHaveBeenCalledWith(
        expect.anything(),
        'tap',
        expect.objectContaining({
          digits_allowed: ['9', '0'],
        }),
      );
    });
  });
});
