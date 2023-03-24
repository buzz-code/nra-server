import { MailerService, } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ImportFile } from '@shared/entities/ImportFile.entity';

@Injectable()
export class MailSendService {
  constructor(private mailerService: MailerService) { }

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


  async sendResponseEmail(from: string, to: string, subject: string, bodyText: string) {
    return this.mailerService
      .sendMail({
        to,
        from,
        subject: 'Re:' + subject,
        text: bodyText,
        html: bodyText,
        // template: false,
      });
  }

  async sendEmailImportResponse(from: string, to: string, subject: string, importedFileData: ImportFile[]) {
    let body = `הודעתך התקבלה`;
    if (importedFileData.length) {
      body += `
      רשימת הקבצים שהתקבלו:
      ${importedFileData
          .map((item, index) => `${(index + 1)}: ${item.fileName} התקבל, תגובה: ${item.response}`)
          .join('\r\n')}`
    }
    return this.sendResponseEmail(from, to, subject, body);
  }
}
