import { describe, expect, it, vi } from "vitest";

import { EmailApprovalStore } from "../src/email/approvalStore";
import { EmailWorkflow } from "../src/email/emailAgent";
import { isValidEmailAddress, loadSmtpConfig } from "../src/email/emailTransport";
import { buildWeeklyMarketReportEmail } from "../src/email/templates/weeklyMarketReport";
import type { EmailSender } from "../src/email/types";
import type { MarketStatsSkillResult } from "../src/skills/market-stats";
import type { MarketStatsReport } from "../src/types/marketStats";

const report: MarketStatsReport = {
  summary: {
    city: "Irvine <script>alert(1)</script>",
    months: 12,
    soldCount: 1,
    averageClosePrice: 900_000,
    medianClosePrice: 900_000,
    averagePricePerSqft: 600,
    averageDaysOnMarket: 12,
    listToClosePercent: 100,
  },
  monthlyTrend: [],
};

function providerResult(): MarketStatsSkillResult {
  return {
    status: "success",
    message: "report",
    filters: {
      city: "Irvine",
      months: 12,
    },
    report: {
      ...report,
      summary: {
        ...report.summary,
        city: "Irvine",
      },
    },
  };
}

describe("Week 11 email safety guardrails", () => {
  it("expires approval instead of sending a stale draft", async () => {
    let now = new Date("2026-09-04T10:00:00.000Z");
    const sender = vi.fn<EmailSender>().mockResolvedValue(undefined);
    const store = new EmailApprovalStore({
      clock: () => now,
      createId: () => "expiring-draft",
      draftTtlMs: 1_000,
    });
    const workflow = new EmailWorkflow({
      approvalStore: store,
      emailSender: sender,
      marketReportProvider: vi.fn().mockResolvedValue(providerResult()),
    });
    await workflow.handle(
      "Draft an Irvine market report to buyer@example.com",
      "user-1",
    );

    now = new Date("2026-09-04T10:00:01.001Z");
    const result = await workflow.handle("CONFIRM EMAIL", "user-1");

    expect(result.status).toBe("no-pending-draft");
    expect(store.getDraft("expiring-draft")?.status).toBe("expired");
    expect(sender).not.toHaveBeenCalled();
  });

  it("replaces an older pending draft rather than keeping two approvals", () => {
    let id = 0;
    const store = new EmailApprovalStore({
      createId: () => `draft-${++id}`,
    });
    const message = {
      to: "buyer@example.com",
      subject: "Market report",
      text: "Report",
      html: "<p>Report</p>",
    };
    const first = store.createDraft("user-1", message);
    const second = store.createDraft("user-1", {
      ...message,
      subject: "Updated report",
    });

    expect(store.getDraft(first.id)?.status).toBe("cancelled");
    expect(store.getPendingDraft("user-1")?.id).toBe(second.id);
  });

  it("rejects multiple recipients and header injection", () => {
    expect(isValidEmailAddress("one@example.com,two@example.com")).toBe(false);
    expect(isValidEmailAddress("buyer@example.com\r\nBcc: attacker@example.com"))
      .toBe(false);
    expect(isValidEmailAddress("buyer@example.com")).toBe(true);
  });

  it("escapes database text in HTML and strips subject newlines", () => {
    const email = buildWeeklyMarketReportEmail("buyer@example.com", report);

    expect(email.html).toContain("Irvine &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it("loads secrets only from environment settings without returning logs", () => {
    expect(loadSmtpConfig({
      EMAIL_USER: "sender@example.com",
      EMAIL_PASSWORD: "app-password",
    })).toEqual({
      service: "gmail",
      host: undefined,
      port: 465,
      secure: true,
      user: "sender@example.com",
      password: "app-password",
      from: "sender@example.com",
    });
  });
});
