import { MailerService } from '@nestjs-modules/mailer';
import { Test, TestingModule } from '@nestjs/testing';
import { ImportFile } from '@shared/entities/ImportFile.entity';
import { MailSendService } from '../mail-send.service';
import { MailData } from '../interface';

describe('MailSendService', () => {
  let service: MailSendService;
  let mailerService: jest.Mocked<MailerService>;

  beforeEach(async () => {
    const mailerServiceMock = {
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailSendService,
        {
          provide: MailerService,
          useValue: mailerServiceMock,
        },
      ],
    }).compile();

    service = module.get<MailSendService>(MailSendService);
    mailerService = module.get(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMail', () => {
    it('should send mail with cleaned text and RTL HTML', async () => {
      const mailOptions = {
        to: 'test@example.com',
        subject: 'Test',
        html: 'שלום עולם - Hello World',
      };

      await service.sendMail(mailOptions);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        ...mailOptions,
        text: 'שלום עולם - Hello World',
        html: '<div dir="rtl">שלום עולם - Hello World</div>',
      });
    });

    it('should handle non-string HTML content', async () => {
      const mailOptions = {
        to: 'test@example.com',
        subject: 'Test',
        html: undefined,
      };

      await service.sendMail(mailOptions);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        ...mailOptions,
        text: undefined,
        html: undefined,
      });
    });

    it('should clean HTML tags for text version', async () => {
      const mailOptions = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hello</p> <strong>World</strong>',
      };

      await service.sendMail(mailOptions);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        ...mailOptions,
        text: 'Hello World',
        html: '<p>Hello</p> <strong>World</strong>',
      });
    });
  });

  describe('sendUserConfirmation', () => {
    it('should send confirmation email', async () => {
      const user = {
        email: 'test@example.com',
        name: 'Test User',
      };
      const token = 'test-token';

      await service.sendUserConfirmation(user, token);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: user.email,
        subject: 'Welcome to Nice App! Confirm your Email',
        template: './confirmation',
        context: {
          name: user.name,
          url: `example.com/auth/confirm?token=${token}`,
        },
        text: undefined,
        html: undefined,
      });
    });
  });

  describe('sendResponseEmail', () => {
    it('should send response email with correct headers', async () => {
      const mailData: MailData = {
        id: 1,
        mail_from: 'sender@example.com',
        rcpt_to: 'recipient@example.com',
        subject: 'Original Subject',
        message_id: 'test-message-id',
        token: 'test-token',
        timestamp: Date.now(),
        size: '1000',
        spam_status: 'clean',
        bounce: false,
        received_with_ssl: true,
        to: 'recipient@example.com',
        cc: null,
        from: 'sender@example.com',
        date: new Date().toISOString(),
        in_reply_to: null,
        references: null,
        html_body: '<p>Test body</p>',
        attachment_quantity: 0,
        auto_submitted: null,
        reply_to: null,
        plain_body: 'Test body',
        attachments: [],
      };
      const htmlText = '<p>Response content</p>';
      const bccAddress = 'bcc@example.com';

      await service.sendResponseEmail(mailData, htmlText, bccAddress);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: mailData.mail_from,
        from: mailData.rcpt_to,
        bcc: bccAddress,
        subject: 'Re:Original Subject',
        html: '<p>Response content</p>',
        text: 'Response content',
        inReplyTo: mailData.message_id,
        references: mailData.message_id,
      });
    });

    it('should handle missing subject', async () => {
      const mailData: MailData = {
        id: 2,
        mail_from: 'sender@example.com',
        rcpt_to: 'recipient@example.com',
        subject: undefined,
        message_id: 'test-message-id',
        token: 'test-token',
        timestamp: Date.now(),
        size: '1000',
        spam_status: 'clean',
        bounce: false,
        received_with_ssl: true,
        to: 'recipient@example.com',
        cc: null,
        from: 'sender@example.com',
        date: new Date().toISOString(),
        in_reply_to: null,
        references: null,
        html_body: '<p>Test body</p>',
        attachment_quantity: 0,
        auto_submitted: null,
        reply_to: null,
        plain_body: 'Test body',
        attachments: [],
      };
      const htmlText = '<p>Response content</p>';

      await service.sendResponseEmail(mailData, htmlText);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: mailData.mail_from,
        from: mailData.rcpt_to,
        bcc: undefined,
        subject: 'Re:',
        html: '<p>Response content</p>',
        text: 'Response content',
        inReplyTo: mailData.message_id,
        references: mailData.message_id,
      });
    });
  });

  describe('sendEmailImportResponse', () => {
    it('should send import response with file list', async () => {
      const mailData: MailData = {
        id: 3,
        mail_from: 'sender@example.com',
        rcpt_to: 'recipient@example.com',
        subject: 'Import Files',
        message_id: 'test-message-id',
        token: 'test-token',
        timestamp: Date.now(),
        size: '1000',
        spam_status: 'clean',
        bounce: false,
        received_with_ssl: true,
        to: 'recipient@example.com',
        cc: null,
        from: 'sender@example.com',
        date: new Date().toISOString(),
        in_reply_to: null,
        references: null,
        html_body: '<p>Test body</p>',
        attachment_quantity: 0,
        auto_submitted: null,
        reply_to: null,
        plain_body: 'Test body',
        attachments: [],
      };
      const importedFiles: ImportFile[] = [
        {
          fileName: 'test1.xlsx',
          response: 'Success',
          fullSuccess: true,
        } as ImportFile,
        {
          fileName: 'test2.xlsx',
          response: 'Partial success',
          fullSuccess: false,
        } as ImportFile,
      ];
      const bccAddress = 'bcc@example.com';

      await service.sendEmailImportResponse(mailData, importedFiles, bccAddress);

      const sentMail = (mailerService.sendMail as jest.Mock).mock.calls[0][0];
      expect(sentMail.to).toBe(mailData.mail_from);
      expect(sentMail.from).toBe(mailData.rcpt_to);
      expect(sentMail.bcc).toBe(bccAddress);
      expect(sentMail.html).toContain('הודעתך התקבלה');
      expect(sentMail.html).toContain('test1.xlsx');
      expect(sentMail.html).toContain('test2.xlsx');
      expect(sentMail.html).toContain('<span style="color:red">Partial success</span>');
    });

    it('should send import response without file list when no files', async () => {
      const mailData: MailData = {
        id: 4,
        mail_from: 'sender@example.com',
        rcpt_to: 'recipient@example.com',
        subject: 'Import Files',
        message_id: 'test-message-id',
        token: 'test-token',
        timestamp: Date.now(),
        size: '1000',
        spam_status: 'clean',
        bounce: false,
        received_with_ssl: true,
        to: 'recipient@example.com',
        cc: null,
        from: 'sender@example.com',
        date: new Date().toISOString(),
        in_reply_to: null,
        references: null,
        html_body: '<p>Test body</p>',
        attachment_quantity: 0,
        auto_submitted: null,
        reply_to: null,
        plain_body: 'Test body',
        attachments: [],
      };
      const importedFiles: ImportFile[] = [];

      await service.sendEmailImportResponse(mailData, importedFiles);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('<h3>הודעתך התקבלה</h3>'),
        })
      );
    });
  });
});