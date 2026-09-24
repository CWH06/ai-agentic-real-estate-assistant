import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import type { EmailMessage, EmailSender } from "./types";

export interface SmtpConfig {
  service?: string;
  host?: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export function loadSmtpConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SmtpConfig {
  const user = requireSetting(environment.EMAIL_USER, "EMAIL_USER");
  const password = requireSetting(
    environment.EMAIL_PASSWORD,
    "EMAIL_PASSWORD",
  );
  const host = environment.EMAIL_HOST?.trim() || undefined;
  const service = environment.EMAIL_SERVICE?.trim()
    || (host ? undefined : "gmail");
  const port = parsePort(environment.EMAIL_PORT, 465);
  const secure = parseBoolean(
    environment.EMAIL_SECURE,
    port === 465,
  );
  const from = environment.EMAIL_FROM?.trim() || user;

  if (!isValidEmailAddress(from)) {
    throw new Error("EMAIL_FROM must be one email address.");
  }

  return {
    service,
    host,
    port,
    secure,
    user,
    password,
    from,
  };
}

export function createNodemailerEmailSender(
  getConfig: () => SmtpConfig = loadSmtpConfig,
): EmailSender {
  return async (message) => {
    validateEmailMessage(message);
    const config = getConfig();
    const options: SMTPTransport.Options = {
      service: config.service,
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
      maxRecipients: 1,
    };
    const transporter = nodemailer.createTransport(options);
    const result = await transporter.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      disableFileAccess: true,
      disableUrlAccess: true,
    });

    return {
      messageId: result.messageId,
    };
  };
}

export function isValidEmailAddress(value: string): boolean {
  if (
    value.length > 254
    || /[\r\n,;]/.test(value)
    || value.trim() !== value
  ) {
    return false;
  }

  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
    .test(value);
}

function validateEmailMessage(message: EmailMessage): void {
  if (!isValidEmailAddress(message.to)) {
    throw new Error("Email recipient must be one valid email address.");
  }

  if (
    !message.subject.trim()
    || message.subject.length > 200
    || /[\r\n]/.test(message.subject)
  ) {
    throw new Error("Email subject is invalid.");
  }

  if (!message.text.trim() || !message.html.trim()) {
    throw new Error("Email body is required.");
  }
}

function requireSetting(
  value: string | undefined,
  name: string,
): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Missing required email setting: ${name}.`);
  return normalized;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("EMAIL_PORT must be an integer between 1 and 65535.");
  }

  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) return fallback;
  if (/^(?:true|1|yes)$/i.test(value)) return true;
  if (/^(?:false|0|no)$/i.test(value)) return false;
  throw new Error("EMAIL_SECURE must be true or false.");
}
