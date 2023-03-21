import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { Global, Module } from '@nestjs/common';
import { MailSendService } from './mail-send.service';

@Global()
@Module({
    imports: [
        MailerModule.forRoot({
            transport: {
                host: 'mail.yoman.online',
                port: 25,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                },
            },
            defaults: {
                from: '"יומן אונליין" <admin@mail.yoman.online>',
            },
            template: {
                dir: __dirname + '/templates',
                adapter: new HandlebarsAdapter(/* helpers */ undefined, {
                    inlineCssEnabled: true,
                    /** See https://www.npmjs.com/package/inline-css#api */
                    inlineCssOptions: {
                        url: ' ',
                        preserveMediaQueries: true,
                    },
                }),
                options: {
                    strict: true,
                },
            },
        }),
    ],
    providers: [MailSendService],
    exports: [MailSendService],
})
export class MailSendModule { }
