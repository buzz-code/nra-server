import { ISendMailOptions } from "@nestjs-modules/mailer";
import * as JSZip from 'jszip';
import { getUserMailAddressFrom, validateUserHasPaid } from "@shared/base-entity/base-entity.util";
import { DataSource } from "typeorm";
import { MailSendService } from "@shared/utils/mail/mail-send.service";
import { BulkToZipReportGenerator } from "@shared/utils/report/bulk-to-zip.generator";
import { Teacher } from "src/db/entities/Teacher.entity";

interface ITeacherFileData {
    teacher: Teacher;
}
type GetEmailParamsFromData = (params: any, data: ITeacherFileData[]) => Promise<{
    replyToAddress: string;
    mailSubject: string;
    mailBody: string;
}>;
export async function sendBulkTeacherMailWithFile(generator: BulkToZipReportGenerator, params: any[], auth: any, dataSource: DataSource, mailSendService: MailSendService, getEmailParamsFromData: GetEmailParamsFromData): Promise<string> {
    if (params.length > 1) {
        await validateUserHasPaid(auth, dataSource, 'בחשבון חינמי אפשר לשלוח רק מייל אחד בכל פעם');
    }

    const responses = [];
    for (const p of params) {
        try {
            const filesData = (await generator.getReportData(p, dataSource)) as ITeacherFileData[];

            if (!filesData[0]?.teacher) {
                responses.push('אין נתונים לשליחה');
                continue;
            }

            if (filesData[0]?.teacher?.email) {
                const zipFileBuffer = await generator.getFileBuffer(filesData);
                const zipContent = await JSZip.loadAsync(zipFileBuffer);

                const attachments: ISendMailOptions['attachments'] = await Promise.all(
                    Object.values(zipContent.files)
                        .map(
                            async (file) => ({
                                filename: file.name,
                                content: await file.async('nodebuffer')
                            })
                        )
                );

                const fromAddress = await getUserMailAddressFrom(auth, dataSource);
                const { replyToAddress, mailSubject, mailBody } = await getEmailParamsFromData(p, filesData);

                await mailSendService.sendMail({
                    to: filesData[0].teacher.email,
                    from: fromAddress,
                    subject: mailSubject,
                    html: mailBody,
                    attachments,
                    replyTo: {
                        address: replyToAddress,
                        name: fromAddress.name,
                    },
                });
                responses.push(`${filesData[0].teacher.name} - נשלח בהצלחה, ${attachments.length} קבצים`);
            } else {
                console.log('bulk mail file: no email for teacher', filesData[0]?.teacher);
                responses.push('לא ניתן לשלוח מייל למורה זו - אין כתובת מייל');
            }
        } catch (e) {
            console.log('error sending bulk mail file', e, params);
            responses.push('שגיאה בשליחת מייל');
        }
    }
    return 'סטטוס מיילים: '
        + responses.map((response, i) => `(${i + 1}) ${response}`).join('\n');
}
