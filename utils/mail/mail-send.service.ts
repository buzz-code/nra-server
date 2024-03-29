import { ISendMailOptions, MailerService, } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ImportFile } from '@shared/entities/ImportFile.entity';
import { SentMessageInfo } from 'nodemailer';
import { MailData } from './interface';

@Injectable()
export class MailSendService {
  constructor(private mailerService: MailerService) { }

  readonly lineBreak = '<br/>';

  sendMail(sendMailOptions: ISendMailOptions): Promise<SentMessageInfo> {
    return this.mailerService.sendMail(sendMailOptions);
  }

  async sendUserConfirmation(user: any, token: string) {
    const url = `example.com/auth/confirm?token=${token}`;

    await this.sendMail({
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


  async sendResponseEmail(mailData: MailData, htmlText: string, bccAddress?: string) {
    return this.sendMail({
      to: mailData.mail_from,
      from: mailData.rcpt_to,
      bcc: bccAddress,
      subject: 'Re:' + (mailData.subject ?? ''),
      text: cleanHtml(htmlText),
      html: addHtmlDirection(htmlText),
      inReplyTo: mailData.message_id,
      references: mailData.message_id,
    });
  }

  async sendEmailImportResponse(mailData: MailData, importedFileData: ImportFile[], bccAddress?: string) {
    let body = `הודעתך התקבלה`;
    if (importedFileData.length) {
      body += `
      ${this.lineBreak}
      רשימת הקבצים שהתקבלו:
      ${this.lineBreak}
      ${importedFileData
          .map((item, index) => `${(index + 1)}: ${getImportFileResponse(item)}`)
          .join(this.lineBreak)}`
    }
    return this.sendResponseEmail(mailData, body, bccAddress);
  }
}

function getImportFileResponse(importedFile: ImportFile) {
  let response = importedFile.response;
  if (!importedFile.fullSuccess) {
    response = `<span style="color:red">${response}</span>`;
  }
  return `קובץ ${importedFile.fileName} התקבל, תגובה: ${response}`;
}

function cleanHtml(html: string) {
  return html.replace(/<[^>]*>/g, '');
}

function addHtmlDirection(html: string) {
  // if text is hebrew, add dir="rtl" to the html tag
  if (html.match(/[\u0590-\u05FF]/)) {
    return `<div dir="rtl">${html}</div>`;
  }
  return html;
}
