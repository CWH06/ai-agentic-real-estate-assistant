import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailApprovalStore } from "../src/email/approvalStore";
import {
  EmailWorkflow,
  extractEmailAddresses,
  isEmailApprovalMessage,
  isEmailCancellationMessage,
} from "../src/email/emailAgent";
import type { EmailSender } from "../src/email/types";
import type { MarketStatsSkillResult } from "../src/skills/market-stats";
import type { MarketStatsReport } from "../src/types/marketStats";
import { parseMarketQuery } from "../src/skills/market-stats";

const marketReport: MarketStatsReport = {
  summary: {
    city: "Irvine",
    months: 6,
    soldCount: 25,
    averageClosePrice: 1_200_000,
    medianClosePrice: 1_150_000,
    averagePricePerSqft: 650,
    averageDaysOnMarket: 21,
    listToClosePercent: 99,
  },
  monthlyTrend: [
    {
      month: "2026-01",
      soldCount: 10,
      averageClosePrice: 1_100_000,
      averagePricePerSqft: 625,
      averageDaysOnMarket: 24,
    },
    {
      month: "2026-06",
      soldCount: 15,
      averageClosePrice: 1_200_000,
      averagePricePerSqft: 675,
      averageDaysOnMarket: 18,
    },
  ],
};

function successfulMarketResult(): MarketStatsSkillResult {
  return {
    status: "success",
    message: "Market report: Irvine",
    filters: {
      city: "Irvine",
      months: 6,
    },
    report: marketReport,
  };
}

describe("EmailWorkflow", () => {
  let emailSender: ReturnType<typeof vi.fn<EmailSender>>;
  let marketReportProvider: ReturnType<
    typeof vi.fn<(query: string) => Promise<MarketStatsSkillResult>>
  >;
  let approvalStore: EmailApprovalStore;
  let workflow: EmailWorkflow;

  beforeEach(() => {
    emailSender = vi.fn<EmailSender>().mockResolvedValue({
      messageId: "test-message-id",
    });
    marketReportProvider = vi.fn().mockResolvedValue(
      successfulMarketResult(),
    );
    approvalStore = new EmailApprovalStore({
      createId: () => "draft-1",
    });
    workflow = new EmailWorkflow({
      approvalStore,
      emailSender,
      marketReportProvider,
    });
  });

  it("creates a data-backed preview without sending", async () => {
    const result = await workflow.handle(
      "Draft a weekly market report for Irvine over 6 months to buyer@example.com",
      "user-1",
    );

    expect(result.status).toBe("drafted");
    expect(result.draft).toMatchObject({
      id: "draft-1",
      userId: "user-1",
      status: "pending_approval",
      to: "buyer@example.com",
      subject: "Weekly Irvine Real Estate Market Report",
    });
    expect(result.message).toContain("Email draft ready — not sent");
    expect(result.message).toContain("Median close price: $1,150,000");
    expect(result.message).toContain("CONFIRM EMAIL");
    expect(emailSender).not.toHaveBeenCalled();
    expect(marketReportProvider).toHaveBeenCalledWith(
      "market report for Irvine over 6 months",
    );
  });

  it("asks for a single recipient before querying market data", async () => {
    const missing = await workflow.handle(
      "Draft a weekly market report for Irvine",
      "user-1",
    );
    const multiple = await workflow.handle(
      "Draft an Irvine market report to one@example.com and two@example.com",
      "user-1",
    );

    expect(missing.status).toBe("needs-recipient");
    expect(multiple.status).toBe("needs-recipient");
    expect(marketReportProvider).not.toHaveBeenCalled();
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("asks for a city and does not create a draft", async () => {
    marketReportProvider.mockResolvedValueOnce({
      status: "needs-city",
      message: "Which city?",
      filters: {
        city: null,
        months: 12,
      },
      report: null,
    });

    const result = await workflow.handle(
      "Email a weekly market report to buyer@example.com",
      "user-1",
    );

    expect(result.status).toBe("needs-city");
    expect(workflow.hasPendingDraft("user-1")).toBe(false);
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("does not mistake email command words for a city", async () => {
    marketReportProvider.mockImplementation(async (query) => ({
      ...successfulMarketResult(), filters: parseMarketQuery(query),
    }));
    const result = await workflow.handle("Email a weekly market report to buyer@example.com", "user-1");
    expect(result.status).toBe("needs-city");
    expect(workflow.hasPendingDraft("user-1")).toBe(false);
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("sends once only after an exact confirmation", async () => {
    await workflow.handle(
      "Draft a weekly market report for Irvine to buyer@example.com",
      "user-1",
    );

    const sent = await workflow.handle("CONFIRM EMAIL", "user-1");
    const repeated = await workflow.handle("CONFIRM EMAIL", "user-1");

    expect(sent).toEqual({
      status: "sent",
      message: "Email sent to buyer@example.com.",
    });
    expect(repeated.status).toBe("no-pending-draft");
    expect(emailSender).toHaveBeenCalledTimes(1);
    expect(approvalStore.getDraft("draft-1")?.status).toBe("sent");
  });

  it("does not treat additional text as approval", async () => {
    await workflow.handle(
      "Draft a weekly market report for Irvine to buyer@example.com",
      "user-1",
    );

    const result = await workflow.handle(
      "Confirm email after changing it",
      "user-1",
    );

    expect(result.status).toBe("needs-recipient");
    expect(workflow.hasPendingDraft("user-1")).toBe(true);
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("cancels a draft and rejects later approval", async () => {
    await workflow.handle(
      "Draft a weekly market report for Irvine to buyer@example.com",
      "user-1",
    );

    const cancelled = await workflow.handle("CANCEL EMAIL", "user-1");
    const confirmation = await workflow.handle("CONFIRM EMAIL", "user-1");

    expect(cancelled.status).toBe("cancelled");
    expect(confirmation.status).toBe("no-pending-draft");
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("does not let another user approve a draft", async () => {
    await workflow.handle(
      "Draft a weekly market report for Irvine to buyer@example.com",
      "user-1",
    );

    const otherUser = await workflow.handle("CONFIRM EMAIL", "user-2");

    expect(otherUser.status).toBe("no-pending-draft");
    expect(workflow.hasPendingDraft("user-1")).toBe(true);
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("locks the draft before sending to prevent concurrent duplicates", async () => {
    let releaseSend: (() => void) | undefined;
    emailSender.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        releaseSend = resolve;
      }),
    );
    await workflow.handle(
      "Draft a weekly market report for Irvine to buyer@example.com",
      "user-1",
    );

    const firstConfirmation = workflow.handle("CONFIRM EMAIL", "user-1");
    const secondConfirmation = await workflow.handle("CONFIRM EMAIL", "user-1");
    releaseSend?.();
    const firstResult = await firstConfirmation;

    expect(firstResult.status).toBe("sent");
    expect(secondConfirmation.status).toBe("no-pending-draft");
    expect(emailSender).toHaveBeenCalledTimes(1);
  });

  it("closes a failed send and never retries automatically", async () => {
    emailSender.mockRejectedValueOnce(new Error("SMTP unavailable"));
    await workflow.handle(
      "Draft a weekly market report for Irvine to buyer@example.com",
      "user-1",
    );

    const failed = await workflow.handle("CONFIRM EMAIL", "user-1");
    const repeated = await workflow.handle("CONFIRM EMAIL", "user-1");

    expect(failed.status).toBe("failed");
    expect(failed.message).not.toContain("SMTP unavailable");
    expect(repeated.status).toBe("no-pending-draft");
    expect(emailSender).toHaveBeenCalledTimes(1);
    expect(approvalStore.getDraft("draft-1")?.status).toBe("failed");
  });
});

describe("email command parsing", () => {
  it("requires complete explicit approval or cancellation commands", () => {
    expect(isEmailApprovalMessage(" CONFIRM EMAIL ")).toBe(true);
    expect(isEmailApprovalMessage("confirm email and edit it")).toBe(false);
    expect(isEmailCancellationMessage("CANCEL EMAIL")).toBe(true);
    expect(isEmailCancellationMessage("do not send anything else")).toBe(false);
  });

  it("extracts unique recipient addresses", () => {
    expect(extractEmailAddresses(
      "Send to Buyer@Example.com and Buyer@Example.com",
    )).toEqual(["Buyer@Example.com"]);
  });
});
