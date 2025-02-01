import { ISendMailOptions } from "@nestjs-modules/mailer";
import { DataSource } from "typeorm";
import { BulkToZipReportGenerator } from "../bulk-to-zip.generator";
import { MailSendService } from "@shared/utils/mail/mail-send.service";
import { Teacher } from "src/db/entities/Teacher.entity";
import { sendBulkTeacherMailWithFile } from "../bulk-mail-file.util";
import * as JSZip from 'jszip';
import * as BaseEntityUtil from "@shared/base-entity/base-entity.util";

jest.mock('jszip');

describe('bulk-mail-file.util', () => {
  let mockGenerator: jest.Mocked<BulkToZipReportGenerator>;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockMailSendService: jest.Mocked<MailSendService>;
  let mockTeacher: Teacher;
  let mockAuth: any;
  let mockParams: any[];
  let mockGetEmailParamsFromData: jest.Mock;
  let mockGetUserMailAddressFrom: jest.SpyInstance;
  let mockValidateUserHasPaid: jest.SpyInstance;

  beforeEach(() => {
    mockTeacher = {
      name: 'Test Teacher',
      email: 'test@example.com'
    } as Teacher;

    mockGenerator = {
      getReportData: jest.fn(),
      getFileBuffer: jest.fn()
    } as any;

    mockDataSource = {} as any;

    mockMailSendService = {
      sendMail: jest.fn()
    } as any;

    mockAuth = { user: { id: 1 } };
    mockParams = [{ id: 1 }];

    mockGetEmailParamsFromData = jest.fn().mockResolvedValue({
      replyToAddress: 'reply@example.com',
      mailSubject: 'Test Subject',
      mailBody: 'Test Body'
    });

    mockGetUserMailAddressFrom = jest.spyOn(BaseEntityUtil, 'getUserMailAddressFrom')
      .mockResolvedValue({ address: 'from@example.com', name: 'Sender' });

    mockValidateUserHasPaid = jest.spyOn(BaseEntityUtil, 'validateUserHasPaid')
      .mockResolvedValue(undefined);

    (JSZip.loadAsync as jest.Mock) = jest.fn().mockResolvedValue({
      files: {
        'file1.pdf': {
          name: 'file1.pdf',
          async: jest.fn().mockResolvedValue(Buffer.from('test'))
        }
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should validate user has paid when sending multiple emails', async () => {
    mockGenerator.getReportData.mockResolvedValue([{ teacher: mockTeacher }]);
    mockGenerator.getFileBuffer.mockResolvedValue(Buffer.from('test'));

    await sendBulkTeacherMailWithFile(
      mockGenerator,
      [{ id: 1 }, { id: 2 }],
      mockAuth,
      mockDataSource,
      mockMailSendService,
      mockGetEmailParamsFromData
    );

    expect(mockValidateUserHasPaid).toHaveBeenCalledWith(
      mockAuth,
      mockDataSource,
      'בחשבון חינמי אפשר לשלוח רק מייל אחד בכל פעם'
    );
  });

  it('should not validate user has paid when sending single email', async () => {
    mockGenerator.getReportData.mockResolvedValue([{ teacher: mockTeacher }]);
    mockGenerator.getFileBuffer.mockResolvedValue(Buffer.from('test'));

    await sendBulkTeacherMailWithFile(
      mockGenerator,
      [{ id: 1 }],
      mockAuth,
      mockDataSource,
      mockMailSendService,
      mockGetEmailParamsFromData
    );

    expect(mockValidateUserHasPaid).not.toHaveBeenCalled();
  });

  it('should send email with attachments when teacher has email', async () => {
    const filesData = [{ teacher: mockTeacher }];
    mockGenerator.getReportData.mockResolvedValue(filesData);
    mockGenerator.getFileBuffer.mockResolvedValue(Buffer.from('test'));

    await sendBulkTeacherMailWithFile(
      mockGenerator,
      mockParams,
      mockAuth,
      mockDataSource,
      mockMailSendService,
      mockGetEmailParamsFromData
    );

    expect(mockMailSendService.sendMail).toHaveBeenCalledWith({
      to: mockTeacher.email,
      from: { address: 'from@example.com', name: 'Sender' },
      subject: 'Test Subject',
      html: 'Test Body',
      attachments: expect.arrayContaining([
        expect.objectContaining({
          filename: 'file1.pdf',
          content: expect.any(Buffer)
        })
      ]),
      replyTo: {
        address: 'reply@example.com',
        name: 'Sender'
      }
    });
  });

  it('should handle case when no data is available', async () => {
    mockGenerator.getReportData.mockResolvedValue([{}]);

    const result = await sendBulkTeacherMailWithFile(
      mockGenerator,
      mockParams,
      mockAuth,
      mockDataSource,
      mockMailSendService,
      mockGetEmailParamsFromData
    );

    expect(result).toContain('אין נתונים לשליחה');
    expect(mockMailSendService.sendMail).not.toHaveBeenCalled();
  });

  it('should handle case when teacher has no email', async () => {
    const teacherWithoutEmail = { ...mockTeacher, email: null };
    mockGenerator.getReportData.mockResolvedValue([{ teacher: teacherWithoutEmail }]);

    const result = await sendBulkTeacherMailWithFile(
      mockGenerator,
      mockParams,
      mockAuth,
      mockDataSource,
      mockMailSendService,
      mockGetEmailParamsFromData
    );

    expect(result).toContain('לא ניתן לשלוח מייל למורה זו - אין כתובת מייל');
    expect(mockMailSendService.sendMail).not.toHaveBeenCalled();
  });

  it('should handle errors during email sending', async () => {
    mockGenerator.getReportData.mockRejectedValue(new Error('Test error'));

    const result = await sendBulkTeacherMailWithFile(
      mockGenerator,
      mockParams,
      mockAuth,
      mockDataSource,
      mockMailSendService,
      mockGetEmailParamsFromData
    );

    expect(result).toContain('שגיאה בשליחת מייל');
    expect(mockMailSendService.sendMail).not.toHaveBeenCalled();
  });

  it('should format response message correctly with multiple statuses', async () => {
    mockGenerator.getReportData
      .mockResolvedValueOnce([{ teacher: mockTeacher }])
      .mockResolvedValueOnce([{}]);

    const result = await sendBulkTeacherMailWithFile(
      mockGenerator,
      [{ id: 1 }, { id: 2 }],
      mockAuth,
      mockDataSource,
      mockMailSendService,
      mockGetEmailParamsFromData
    );

    expect(result).toContain('סטטוס מיילים:');
    expect(result).toContain('(1) Test Teacher - נשלח בהצלחה');
    expect(result).toContain('(2) אין נתונים לשליחה');
  });
});