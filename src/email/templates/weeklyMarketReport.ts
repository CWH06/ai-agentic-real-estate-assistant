import { formatMarketStats } from "../../skills/market-stats/formatMarketStats";
import type { MarketStatsReport } from "../../types/marketStats";
import type { EmailMessage } from "../types";

export function buildWeeklyMarketReportEmail(
  to: string,
  report: MarketStatsReport,
): EmailMessage {
  const city = cleanHeaderText(report.summary.city);
  const reportText = formatMarketStats(report);
  const text = [
    `Weekly ${city} Real Estate Market Report`,
    "",
    reportText,
    "",
    "This report is informational and is based on available california_sold records.",
  ].join("\n");

  return {
    to,
    subject: `Weekly ${city} Real Estate Market Report`,
    text,
    html: [
      "<!doctype html>",
      '<html lang="en">',
      "<body>",
      `<h1>Weekly ${escapeHtml(city)} Real Estate Market Report</h1>`,
      `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(reportText)}</pre>`,
      "<p><small>This report is informational and is based on available california_sold records.</small></p>",
      "</body>",
      "</html>",
    ].join(""),
  };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function cleanHeaderText(value: string): string {
  const cleaned = value.replace(/[\r\n]+/g, " ").trim().slice(0, 100);
  return cleaned || "California";
}
