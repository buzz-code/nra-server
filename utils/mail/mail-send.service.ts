import { MailerService, } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ImportFile } from '@shared/entities/ImportFile.entity';
import { MailData } from './interface';

@Injectable()
export class MailSendService {
  constructor(private mailerService: MailerService) { }

  readonly lineBreak = '\r\n<br/>';

  async sendUserConfirmation(user: any, token: string) {
    const url = `example.com/auth/confirm?token=${token}`;

    await this.mailerService.sendMail({
      to: user.email,
      // from: '"Support Team" <support@example.com>', // override default from
      subject: 'Welcome to Nice App! Confirm your Email',
      template: './confirmation', // `.hbs` extension is appended automatically
      context: { // ✏️ filling curly brackets with content
        name: user.name,
        url,
      },
    });
  }


  async sendResponseEmail(mailData: MailData, bodyText: string) {
    return this.mailerService
      .sendMail({
        to: mailData.mail_from,
        from: mailData.rcpt_to,
        subject: 'Re:' + (mailData.subject ?? ''),
        text: bodyText,
        html: bodyText,
        inReplyTo: mailData.message_id,
        references: mailData.message_id,
      });
  }

  async sendEmailImportResponse(mailData: MailData, importedFileData: ImportFile[]) {
    let body = `הודעתך התקבלה`;
    if (importedFileData.length) {
      body += `
      ${this.lineBreak}
      רשימת הקבצים שהתקבלו:
      ${this.lineBreak}
      ${importedFileData
          .map((item, index) => `${(index + 1)}: ${item.fileName} התקבל, תגובה: ${item.response}`)
          .join(this.lineBreak)}`
    }
    return this.sendResponseEmail(mailData, body);
  }
}
