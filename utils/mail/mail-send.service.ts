import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ImportFile } from '@shared/entities/ImportFile.entity';
import { SentMessageInfo } from 'nodemailer';
import { MailData } from './interface';

@Injectable()
export class MailSendService {
  constructor(private mailerService: MailerService) { }

  readonly lineBreak = '<br/>';

  sendMail(sendMailOptions: ISendMailOptions): Promise<SentMessageInfo> {
    return this.mailerService.sendMail({
      ...sendMailOptions,
      text: sendMailOptions.text ?? cleanHtml(sendMailOptions.html),
      html: addHtmlDirection(sendMailOptions.html),
    });
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
      html: htmlText,
      inReplyTo: mailData.message_id,
      references: mailData.message_id,
    });
  }

  async sendEmailImportResponse(mailData: MailData, importedFileData: ImportFile[], bccAddress?: string) {
    let body = `<h3>הודעתך התקבלה</h3>`;
    if (importedFileData.length) {
      body += `${this.lineBreak}
        <h4>רשימת הקבצים שהתקבלו</h3>
        <table style="border: 1px solid black; border-collapse: collapse">
          <tr style="padding: 10px;">
            <th style="border: 1px solid black">קובץ</th>
            <th style="border: 1px solid black">תגובה</th>
          </tr>
          ${importedFileData
          .map((importedFile) => `
              <tr>
                <td style="padding: 10px; border-inline: 1px solid black">${importedFile.fileName}</td>
                <td style="padding: 10px">${getImportFileResponse(importedFile)}</td>
              </tr>
            `)
          .join('')}
        </table>`;
    }
    return this.sendResponseEmail(mailData, body, bccAddress);
  }
}

function getImportFileResponse(importedFile: ImportFile) {
  let response = importedFile.response;
  if (!importedFile.fullSuccess) {
    response = `<span style="color:red">${response}</span>`;
  }
  return response;
}

function cleanHtml(html: ISendMailOptions['html']) {
  if (typeof html !== 'string') {
    return html;
  }
  return html.replace(/<[^>]*>/g, '');
}

function addHtmlDirection(html: ISendMailOptions['html']) {
  if (typeof html !== 'string') {
    return html;
  }
  // if text is hebrew, add dir="rtl" to the html tag
  if (html.match(/[\u0590-\u05FF]/)) {
    return `<div dir="rtl">${html}</div>`;
  }
  return html;
}
