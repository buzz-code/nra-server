import { DataSource, In, getRepository } from "typeorm";
import { FormatString, YEMOT_HANGUP_STEP, YemotProcessor, YemotRequest, YemotResponse } from "../yemot.interface";
import { YemotCall, YemotParams } from "@shared/entities/YemotCall.entity";
import { TextByUser } from "@shared/view-entities/TextByUser.entity";
import { User } from "@shared/entities/User.entity";
import util from "../yemot.util";
import { AttReport } from "src/db/entities/AttReport.entity";
import { Grade } from "src/db/entities/Grade.entity";
import { getCurrentHebrewYear } from "../../entity/year.util";

export class MockYemotRequest extends YemotRequest {
  constructor(activeCall: any, dataSource: any) {
    super(activeCall, dataSource);
  }
  getLessonFromLessonId(lessonId: number) {
    return {} as any;
  }
  getKlassByKlassId(klassKey: number, klassId?: number) {
    return {} as any;
  }
  getTeacherByPhone(phone: string) {
    return {} as any;
  }
  getStudentsByKlassId(klassId: number) {
    return [] as any;
  }
  saveReport(reportData: any, type: any) {
    return {} as any;
  }
  getExistingAttReports(klassId: string, lessonId: string, sheetName: string) {
    return [] as any;
  }
  getExistingGradeReports(klassId: string, lessonId: string, sheetName: string) {
    return [] as any;
  }
  deleteExistingReports(existingReports: any[], type: any) {
    return {} as any;
  }
}

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

export const getMockDataSource = () => ({
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
    yemotRequest = new MockYemotRequest(activeCall, dataSource);
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
