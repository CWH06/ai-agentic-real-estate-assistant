export type EmailDraftStatus =
  | "pending_approval"
  | "sending"
  | "sent"
  | "cancelled"
  | "failed"
  | "expired";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailDraft extends EmailMessage {
  id: string;
  userId: string;
  status: EmailDraftStatus;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
}

export interface EmailDeliveryResult {
  messageId?: string;
}

export type EmailSender = (
  message: EmailMessage,
) => Promise<EmailDeliveryResult | void>;
