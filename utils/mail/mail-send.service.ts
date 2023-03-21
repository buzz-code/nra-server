import { MailerService, } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

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


  async sendMail() {
    this.mailerService
      .sendMail({
        to: 'hadasa.schechter+1@gmail.com', // list of receivers
        // from: 'noreply@nestjs.com', // sender address
        subject: 'Testing Nest MailerModule ✔', // Subject line
        text: 'welcome', // plaintext body
        html: '<b>welcome</b>', // HTML body content
      })
      .then(console.log)
      .catch(console.log);
  }
}
