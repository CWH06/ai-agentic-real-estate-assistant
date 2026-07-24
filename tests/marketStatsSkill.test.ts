import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketStatsReport } from "../src/types/marketStats";

const { getMarketStatsReportMock } = vi.hoisted(() => ({
  getMarketStatsReportMock: vi.fn(),
}));

vi.mock("../src/db/marketStats", () => ({
  getMarketStatsReport: getMarketStatsReportMock,
}));

import { marketStatsSkill } from "../src/skills/market-stats";

const report: MarketStatsReport = {
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

describe("marketStatsSkill", () => {
  beforeEach(() => {
    getMarketStatsReportMock.mockReset();
  });

  it("asks for a city without calling the database", async () => {
    const result = await marketStatsSkill(
      "Are home prices rising over 6 months?",
    );

    expect(result).toEqual({
      status: "needs-city",
      message:
        "Which California city would you like market statistics for?",
      filters: {
        city: null,
        months: 6,
      },
      report: null,
    });
    expect(getMarketStatsReportMock).not.toHaveBeenCalled();
  });

  it("queries and formats a complete city market report", async () => {
    getMarketStatsReportMock.mockResolvedValueOnce(report);

    const result = await marketStatsSkill(
      "Show me the market in Irvine over 6 months",
    );

    expect(getMarketStatsReportMock).toHaveBeenCalledWith(
      "Irvine",
      6,
    );
    expect(result.status).toBe("success");
    expect(result.filters).toEqual({
      city: "Irvine",
      months: 6,
    });
    expect(result.report).toEqual(report);
    expect(result.message).toContain("Market report: Irvine");
    expect(result.message).toContain(
      "Median close price: $1,150,000",
    );
  });

  it("returns a no-sales message as a successful query", async () => {
    const emptyReport: MarketStatsReport = {
      summary: {
        ...report.summary,
        city: "Unknown City",
        soldCount: 0,
      },
      monthlyTrend: [],
    };
    getMarketStatsReportMock.mockResolvedValueOnce(emptyReport);

    const result = await marketStatsSkill(
      "Show me the market in Unknown City",
    );

    expect(result.status).toBe("success");
    expect(result.message).toContain(
      "couldn't find recent residential sales",
    );
  });

  it("returns a friendly error when the database query fails", async () => {
    getMarketStatsReportMock.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const result = await marketStatsSkill(
      "What is the market in Irvine?",
    );

    expect(result).toEqual({
      status: "error",
      message:
        "I couldn't retrieve market statistics for Irvine. Please try again.",
      filters: {
        city: "Irvine",
        months: 12,
      },
      report: null,
    });
  });
});
