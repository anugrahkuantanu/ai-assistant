import type { Tool } from "@modelcontextprotocol/sdk/types.js";
declare function readEmails({ limit, email, password, imapHost, imapPort, secure }: {
    limit?: number;
    email: string;
    password: string;
    imapHost: string;
    imapPort?: number;
    secure?: boolean;
}): Promise<{
    success: boolean;
    error: string;
    emails: never[];
    count: number;
    provider?: never;
    timestamp?: never;
} | {
    success: boolean;
    count: number;
    emails: {
        id: string;
        subject: string;
        from: string;
        fromName: string;
        to: string;
        date: string;
        body: string;
        hasAttachments: boolean;
    }[];
    provider: string;
    timestamp: string;
    error?: never;
}>;
declare function sendEmail({ to, subject, body, htmlBody, priority, email, password, smtpHost, smtpPort, secure }: {
    to: string;
    subject: string;
    body: string;
    htmlBody?: string;
    priority?: "low" | "normal" | "high";
    email: string;
    password: string;
    smtpHost: string;
    smtpPort?: number;
    secure?: boolean;
}): Promise<{
    success: boolean;
    error: string;
    troubleshooting?: never;
    messageId?: never;
    response?: never;
    accepted?: never;
    rejected?: never;
    pending?: never;
    to?: never;
    subject?: never;
    priority?: never;
    provider?: never;
    timestamp?: never;
    deliveryInfo?: never;
    originalError?: never;
} | {
    success: boolean;
    error: string;
    troubleshooting: string[];
    messageId?: never;
    response?: never;
    accepted?: never;
    rejected?: never;
    pending?: never;
    to?: never;
    subject?: never;
    priority?: never;
    provider?: never;
    timestamp?: never;
    deliveryInfo?: never;
    originalError?: never;
} | {
    success: boolean;
    messageId: string;
    response: string;
    accepted: (string | import("nodemailer/lib/mailer").Address)[];
    rejected: (string | import("nodemailer/lib/mailer").Address)[];
    pending: (string | import("nodemailer/lib/mailer").Address)[];
    to: string;
    subject: string;
    priority: "low" | "normal" | "high";
    provider: string;
    timestamp: string;
    deliveryInfo: {
        messageId: string;
        accepted: (string | import("nodemailer/lib/mailer").Address)[];
        rejected: (string | import("nodemailer/lib/mailer").Address)[];
        pending: (string | import("nodemailer/lib/mailer").Address)[];
        envelope: import("nodemailer/lib/mime-node").Envelope;
    };
    error?: never;
    troubleshooting?: never;
    originalError?: never;
} | {
    success: boolean;
    error: string;
    originalError: string;
    timestamp: string;
    troubleshooting: string[];
    messageId?: never;
    response?: never;
    accepted?: never;
    rejected?: never;
    pending?: never;
    to?: never;
    subject?: never;
    priority?: never;
    provider?: never;
    deliveryInfo?: never;
}>;
declare function testEmailConnection({ email, password, smtpHost, smtpPort, secure }: {
    email: string;
    password: string;
    smtpHost: string;
    smtpPort?: number;
    secure?: boolean;
}): Promise<{
    success: boolean;
    error: string;
    details: {
        email: string;
        password: string;
        smtpHost: string;
    };
    message?: never;
    config?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    message: string;
    config: {
        imapHost: string;
        imapPort: number;
        smtpHost: string;
        smtpPort: number;
        email: string;
        secure: boolean;
    };
    timestamp: string;
    error?: never;
    details?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    troubleshooting: string[];
    timestamp: string;
    details?: never;
    message?: never;
    config?: never;
}>;
export declare const emailTools: Tool[];
export declare function handleEmailTool(name: string, args: any): Promise<any>;
export { readEmails, sendEmail, testEmailConnection };
//# sourceMappingURL=email.d.ts.map