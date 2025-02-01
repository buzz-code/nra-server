import { DataSource, In, getRepository } from "typeorm";
import { FormatString, YEMOT_HANGUP_STEP, YemotProcessor, YemotRequest, YemotResponse } from "../yemot.interface";
import { YemotCall, YemotParams } from "@shared/entities/YemotCall.entity";
import { TextByUser } from "@shared/view-entities/TextByUser.entity";
import { User } from "@shared/entities/User.entity";
import util from "../yemot.util";
import { AttReport } from "src/db/entities/AttReport.entity";
import { Grade } from "src/db/entities/Grade.entity";
import { getCurrentHebrewYear } from "../../entity/year.util";

describe('FormatString', () => {
  it('should replace placeholders with values', () => {
    const result = FormatString("Hello {0}, you have {1} new messages.", ["John", "5"]);
    expect(result).toBe("Hello John, you have 5 new messages.");
  });

  it('should not replace anything if no placeholders', () => {
    const result = FormatString("Hello World!", ["test"]);
    expect(result).toBe("Hello World!");
  });
});

const getMockDataSource = () => ({
  getRepository: jest.fn().mockReturnValue({
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn(),
    findBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  })
} as unknown as DataSource);

class MockYemotProcessor extends YemotProcessor {
  processCall(activeCall: YemotCall, body: YemotParams): Promise<YemotResponse> {
    throw new Error("Method not implemented.");
  }

  getTextPublic(userId: number, textKey: string, ...args): Promise<string> {
    return this.getText(userId, textKey, ...args);
  }
}

describe('YemotProcessor', () => {
  let dataSource: DataSource;
  let yemotProcessor: MockYemotProcessor;

  beforeEach(() => {
    dataSource = getMockDataSource();
    yemotProcessor = new MockYemotProcessor(dataSource);
  });

  it('should return formatted text for a given user and text key', async () => {
    const userId = 1;
    const textKey = "greeting";
    const args = ["John"];
    const textValue = "Hello {0}";

    // Mock the database call
    jest.spyOn(dataSource.getRepository(TextByUser), 'findOne').mockResolvedValue({ value: textValue } as TextByUser);

    const result = await yemotProcessor.getTextPublic(userId, textKey, ...args);
    expect(result).toBe("Hello John");
  });

  it('should handle cases where textKey does not exist', async () => {
    const userId = 1;
    const textKey = "nonexistent";

    // Mock the database call
    jest.spyOn(dataSource.getRepository(TextByUser), 'findOne').mockResolvedValue(null);

    const result = await yemotProcessor.getTextPublic(userId, textKey);
    expect(result).toBe(textKey);
  });
});

describe('YemotRequest', () => {
  let dataSource: DataSource;
  let yemotRequest: YemotRequest;
  let activeCall: YemotCall;

  beforeEach(() => {
    dataSource = getMockDataSource();
    activeCall = new YemotCall();
    activeCall.userId = 1;
    yemotRequest = new YemotRequest(activeCall, dataSource);
  });

  it('should return the correct userId from the active call', () => {
    const result = yemotRequest.getUserId();
    expect(result).toBe(1);
  });

  it('should return user permissions for the given userId', async () => {
    const user = { id: 1, permissions: ["READ", "WRITE"] };

    // Mock the database call
    jest.spyOn(yemotRequest, 'getUser').mockResolvedValue(user as User);

    const result = await yemotRequest.getUserPermissions();
    expect(result).toEqual(["READ", "WRITE"]);
  });

  it('should get lesson by lesson id', async () => {
    const lessonId = 1;
    const lesson = { id: 1 };

    jest.spyOn(dataSource.getRepository(YemotCall), 'findOneBy').mockResolvedValue(lesson as YemotCall);

    const result = await yemotRequest.getLessonFromLessonId(lessonId);
    expect(result).toEqual(lesson);
  });

  it('should get klass by klass id', async () => {
    const klassId = 1;
    const klass = { id: 1 };

    const mock = jest.spyOn(dataSource.getRepository(YemotCall), 'findOneBy').mockResolvedValue(klass as YemotCall);

    const result = await yemotRequest.getKlassByKlassId(null, klassId);
    expect(result).toEqual(klass);
    expect(mock).toHaveBeenCalledWith({ id: klassId });
  });

  it('should get klass by key', async () => {
    const klassKey = 1;
    const klass = { id: 1 };

    const mock = jest.spyOn(dataSource.getRepository(YemotCall), 'findOneBy').mockResolvedValue(klass as YemotCall);

    const result = await yemotRequest.getKlassByKlassId(klassKey, null);
    expect(result).toEqual(klass);
    expect(mock).toHaveBeenCalledWith({ key: klassKey, userId: 1, year: getCurrentHebrewYear() });
  });

  it('should get teacher by phone', async () => {
    const phone = '1234567890';
    const teacher = { id: 1 };

    jest.spyOn(dataSource.getRepository(YemotCall), 'findOne').mockResolvedValue(teacher as YemotCall);

    const result = await yemotRequest.getTeacherByPhone(phone);
    expect(result).toEqual(teacher);
  });

  it('should get students by klass id', async () => {
    const klassId = 1;
    const students = [{ id: 1 }, { id: 2 }];

    jest.spyOn(dataSource.getRepository(YemotCall), 'find').mockResolvedValue(students.map(student => ({ student })) as any[] as YemotCall[]);

    const result = await yemotRequest.getStudentsByKlassId(klassId);
    expect(result).toEqual(students);
  });

  it('should save report', async () => {
    const reportData = { id: 1 };
    const type = 'att';

    jest.spyOn(yemotRequest, 'getExistingAttReports').mockResolvedValue([]);
    jest.spyOn(yemotRequest, 'getExistingGradeReports').mockResolvedValue([]);
    jest.spyOn(dataSource.getRepository(AttReport), 'create').mockResolvedValue(reportData as never);

    const result = await yemotRequest.saveReport(reportData as AttReport, type);
    expect(result).toEqual(reportData);

    expect(dataSource.getRepository).toHaveBeenCalledWith(AttReport);
  });

  it('should get existing att reports', async () => {
    jest.spyOn(dataSource.getRepository(AttReport), 'findBy').mockResolvedValue([]);

    const result = await yemotRequest.getExistingAttReports(null, null, null);
    expect(result).toEqual([]);
  });

  it('should get existing grade reports', async () => {
    jest.spyOn(dataSource.getRepository(Grade), 'findBy').mockResolvedValue([]);

    const result = await yemotRequest.getExistingGradeReports(null, null, null);
    expect(result).toEqual([]);
  });

  it('should delete existing reports', async () => {
    const existingReports = [{ id: 1 }, { id: 2 }];

    const attMock = jest.spyOn(dataSource.getRepository(AttReport), 'delete').mockResolvedValue(null);
    const gradeMock = jest.spyOn(dataSource.getRepository(Grade), 'delete').mockResolvedValue(null);

    const result = await yemotRequest.deleteExistingReports(existingReports as (AttReport | Grade)[], 'att');
    expect(result).toEqual(undefined);
    expect(attMock).toHaveBeenCalledWith({ id: In([1, 2]) });

    const result2 = await yemotRequest.deleteExistingReports(existingReports as (AttReport | Grade)[], 'grade');
    expect(result2).toEqual(undefined);
    expect(gradeMock).toHaveBeenCalledWith({ id: In([1, 2]) });
  });
});

describe('YemotResponse', () => {
  let dataSource: DataSource;
  let yemotResponse: YemotResponse;

  beforeEach(() => {
    dataSource = getMockDataSource();
    yemotResponse = new YemotResponse(dataSource, 1);
  });

  it('should return the correct formatted text for a given text key', async () => {
    const textKey = "greeting";
    const args = ["John"];
    const textValue = "Hello {0}";

    // Mock the database call
    jest.spyOn(dataSource.getRepository(TextByUser), 'findOne').mockResolvedValue({ value: textValue } as TextByUser);

    const result = await yemotResponse.getText(textKey, ...args);
    expect(result).toBe("Hello John");
  });

  it('should return the correct hangup step', () => {
    const result = yemotResponse.hangup();
    expect(result).toBe(YEMOT_HANGUP_STEP);
  });

  it('should clear all messages', () => {
    yemotResponse.send("Test message");
    yemotResponse.clear();
    expect(yemotResponse.messages.length).toBe(0);
  });

  it('should correctly send a message with given parameters and options', () => {
    yemotResponse.send("Test message", "param1", { option: "value" });
    expect(yemotResponse.messages.length).toBe(1);
    expect(yemotResponse.messages[0]).toEqual({ text: "Test message", param: "param1", options: { option: "value" } });
  });

  it('should correctly send a message with given parameters', async () => {
    yemotResponse.send(yemotResponse.hangup());
    expect(yemotResponse.messages.length).toBe(1);
    const response = await yemotResponse.getResponse();
    expect(response).toBe(util.send(util.hangup()));
  });

  it('should get the key for the text if not found', async () => {
    jest.spyOn(dataSource.getRepository(TextByUser), 'findOne').mockResolvedValue(null);
    const result = await yemotResponse.getText("test");
    expect(result).toBe("test");
  });
});
