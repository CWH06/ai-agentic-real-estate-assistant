import { marketStatsSkill } from "../skills/market-stats";
import type { MarketStatsSkillResult } from "../skills/market-stats";
import { EmailApprovalStore } from "./approvalStore";
import { createNodemailerEmailSender, isValidEmailAddress } from "./emailTransport";
import { buildWeeklyMarketReportEmail } from "./templates/weeklyMarketReport";
import type { EmailDraft, EmailSender } from "./types";

export type EmailWorkflowStatus =
  | "drafted"
  | "needs-recipient"
  | "needs-city"
  | "unsupported"
  | "sent"
  | "cancelled"
  | "no-pending-draft"
  | "failed";

export interface EmailWorkflowResult {
  status: EmailWorkflowStatus;
  message: string;
  draft?: EmailDraft;
}

export interface EmailWorkflowDependencies {
  approvalStore?: EmailApprovalStore;
  emailSender?: EmailSender;
  marketReportProvider?: (
    query: string,
  ) => Promise<MarketStatsSkillResult>;
}

const APPROVAL_PATTERN = /^(?:confirm(?: email)?|approve(?: email)?|send (?:the )?email|send it)$/i;
const CANCELLATION_PATTERN = /^(?:cancel(?: email)?|discard(?: email)?|do not send|don't send)$/i;
const EMAIL_ADDRESS_PATTERN = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}/gi;

export class EmailWorkflow {
  private readonly approvalStore: EmailApprovalStore;
  private readonly emailSender: EmailSender;
  private readonly marketReportProvider: (
    query: string,
  ) => Promise<MarketStatsSkillResult>;

  constructor(dependencies: EmailWorkflowDependencies = {}) {
    this.approvalStore = dependencies.approvalStore ?? new EmailApprovalStore();
    this.emailSender = dependencies.emailSender ?? createNodemailerEmailSender();
    this.marketReportProvider = dependencies.marketReportProvider ?? marketStatsSkill;
  }

  hasPendingDraft(userId: string): boolean {
    return this.approvalStore.getPendingDraft(userId) !== null;
  }

  clear(userId?: string): void {
    this.approvalStore.clear(userId);
  }

  async handle(query: string, userId: string): Promise<EmailWorkflowResult> {
    const normalized = normalize(query);

    if (isEmailApprovalMessage(normalized)) {
      return this.sendApprovedDraft(userId);
    }

    if (isEmailCancellationMessage(normalized)) {
      return this.cancelDraft(userId);
    }

    return this.draftWeeklyMarketReport(normalized, userId);
  }

  private async draftWeeklyMarketReport(
    query: string,
    userId: string,
  ): Promise<EmailWorkflowResult> {
    const recipients = extractEmailAddresses(query);

    if (recipients.length === 0) {
      return {
        status: "needs-recipient",
        message:
          "Please include one recipient email address, for example: "
          + "Draft a weekly market report for Irvine to name@example.com. No email was sent.",
      };
    }

    if (recipients.length !== 1 || !isValidEmailAddress(recipients[0])) {
      return {
        status: "needs-recipient",
        message: "Please provide exactly one valid recipient email address. No email was sent.",
      };
    }

    if (!isWeeklyMarketReportRequest(query)) {
      return {
        status: "unsupported",
        message:
          "This email workflow currently drafts weekly market reports. Try: "
          + "Draft a weekly market report for Irvine to name@example.com. No email was sent.",
      };
    }

    const reportResult = await this.marketReportProvider(
      removeRecipientFromQuery(query, recipients[0]),
    );

    if (reportResult.status === "needs-city" || !reportResult.filters.city) {
      return {
        status: "needs-city",
        message:
          "Which California city should the weekly email report cover? "
          + "Please include the city and recipient in one request. No email was sent.",
      };
    }

    if (reportResult.status !== "success" || !reportResult.report) {
      return {
        status: "failed",
        message:
          `I couldn't prepare the ${reportResult.filters.city} market report right now. `
          + "No email was sent.",
      };
    }

    const email = buildWeeklyMarketReportEmail(
      recipients[0],
      reportResult.report,
    );
    const draft = this.approvalStore.createDraft(userId, email);

    return {
      status: "drafted",
      draft,
      message: formatDraftPreview(draft),
    };
  }

  private async sendApprovedDraft(
    userId: string,
  ): Promise<EmailWorkflowResult> {
    const draft = this.approvalStore.beginApproval(userId);

    if (!draft) {
      return noPendingDraftResult();
    }

    try {
      await this.emailSender({
        to: draft.to,
        subject: draft.subject,
        text: draft.text,
        html: draft.html,
      });
      this.approvalStore.markSent(draft.id);

      return {
        status: "sent",
        message: `Email sent to ${draft.to}.`,
      };
    } catch {
      this.approvalStore.markFailed(draft.id);
      return {
        status: "failed",
        message:
          "I couldn't send the approved email. It will not be retried automatically; "
          + "create and approve a new draft to try again.",
      };
    }
  }

  private cancelDraft(userId: string): EmailWorkflowResult {
    const draft = this.approvalStore.cancelPending(userId);

    if (!draft) return noPendingDraftResult();

    return {
      status: "cancelled",
      message: `Email draft to ${draft.to} cancelled. No email was sent.`,
    };
  }
}

export function isEmailApprovalMessage(query: string): boolean {
  return APPROVAL_PATTERN.test(normalize(query));
}

export function isEmailCancellationMessage(query: string): boolean {
  return CANCELLATION_PATTERN.test(normalize(query));
}

export function extractEmailAddresses(query: string): string[] {
  return Array.from(new Set(query.match(EMAIL_ADDRESS_PATTERN) ?? []));
}

export function isEmailDecisionMessage(query: string): boolean {
  return isEmailApprovalMessage(query) || isEmailCancellationMessage(query);
}

const defaultEmailWorkflow = new EmailWorkflow();

export async function emailAgent(
  query: string,
  userId: string,
): Promise<EmailWorkflowResult> {
  return defaultEmailWorkflow.handle(query, userId);
}

export function hasPendingEmailDraft(userId: string): boolean {
  return defaultEmailWorkflow.hasPendingDraft(userId);
}

export function clearEmailApprovalState(userId?: string): void {
  defaultEmailWorkflow.clear(userId);
}

function isWeeklyMarketReportRequest(query: string): boolean {
  return /\b(?:market|sold|sales|price|dom|days on market|weekly report)\b/i
    .test(query);
}

function removeRecipientFromQuery(query: string, recipient: string): string {
  return query
    .replaceAll(recipient, " ")
    .replace(/\bto\s*(?=$|[,.?!])/gi, " ")
    .replace(/^(?:please\s+)?(?:draft|compose|send|email)\s+(?:(?:me|an?|the|email|with|weekly)\s+)*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatDraftPreview(draft: EmailDraft): string {
  return [
    "Email draft ready — not sent",
    `To: ${draft.to}`,
    `Subject: ${draft.subject}`,
    "",
    draft.text,
    "",
    "Reply exactly CONFIRM EMAIL to send it, or CANCEL EMAIL to discard it.",
    "This approval expires in 30 minutes.",
  ].join("\n");
}

function noPendingDraftResult(): EmailWorkflowResult {
  return {
    status: "no-pending-draft",
    message: "There is no pending email draft for you. No email was sent.",
  };
}
