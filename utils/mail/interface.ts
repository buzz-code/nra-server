export interface HandleEmailBody {
    mail_data: MailData;
}

export interface MailData {
    id: number;
    rcpt_to: string;
    mail_from: string;
    token: string;
    subject: string;
    message_id: string;
    timestamp: number;
    size: string;
    spam_status: string;
    bounce: boolean;
    received_with_ssl: boolean;
    to: string;
    cc: null;
    from: string;
    date: string;
    in_reply_to: null;
    references: null;
    html_body: string;
    attachment_quantity: number;
    auto_submitted: null;
    reply_to: null;
    plain_body: string;
    attachments: AttachmentData[];
}

export interface AttachmentData {
    filename:string;
    content_type:string;
    size:number;
    data:string;
}