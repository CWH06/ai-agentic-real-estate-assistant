import { describe, expect, it } from "vitest";
import type { MarketStatsReport } from "../src/types/marketStats";
import {
  calculatePriceTrend,
  formatCurrency,
  formatMarketStats,
} from "../src/skills/market-stats/formatMarketStats";

const report: MarketStatsReport = {
  summary: {
    city: "Irvine",
    months: 12,
    soldCount: 1_250,
    averageClosePrice: 1_450_000,
    medianClosePrice: 1_325_000,
    averagePricePerSqft: 725,
    averageDaysOnMarket: 24.2,
    listToClosePercent: 99.2,
  },
  monthlyTrend: [
    {
      month: "2025-05",
      soldCount: 90,
      averageClosePrice: 1_300_000,
      averagePricePerSqft: 690,
      averageDaysOnMarket: 27,
    },
    {
      month: "2026-04",
      soldCount: 110,
      averageClosePrice: 1_365_000,
      averagePricePerSqft: 715,
      averageDaysOnMarket: 23,
    },
  ],
};

describe("calculatePriceTrend", () => {
  it("identifies a rising market", () => {
    expect(calculatePriceTrend(report.monthlyTrend)).toEqual({
      direction: "rising",
      changePercent: 5,
      earliestMonth: "2025-05",
      latestMonth: "2026-04",
    });
  });

  it("identifies a falling market", () => {
    expect(
      calculatePriceTrend([
        { ...report.monthlyTrend[0], averageClosePrice: 1_000_000 },
        { ...report.monthlyTrend[1], averageClosePrice: 900_000 },
      ]),
    ).toEqual({
      direction: "falling",
      changePercent: -10,
      earliestMonth: "2025-05",
      latestMonth: "2026-04",
    });
  });

  it("identifies a stable market within the two-percent threshold", () => {
    const result = calculatePriceTrend([
      { ...report.monthlyTrend[0], averageClosePrice: 1_000_000 },
      { ...report.monthlyTrend[1], averageClosePrice: 1_010_000 },
    ]);

    expect(result.direction).toBe("stable");
    expect(result.changePercent).toBeCloseTo(1);
  });

  it("ignores months without a valid average price", () => {
    const result = calculatePriceTrend([
      { ...report.monthlyTrend[0], averageClosePrice: null },
      { ...report.monthlyTrend[0], month: "2025-06", averageClosePrice: 1_000_000 },
      { ...report.monthlyTrend[1], averageClosePrice: 1_100_000 },
    ]);

    expect(result).toMatchObject({
      direction: "rising",
      earliestMonth: "2025-06",
      latestMonth: "2026-04",
    });
  });

  it("reports insufficient data when fewer than two valid months exist", () => {
    expect(calculatePriceTrend([])).toEqual({
      direction: "insufficient-data",
      changePercent: null,
      earliestMonth: null,
      latestMonth: null,
    });

    expect(
      calculatePriceTrend([
        { ...report.monthlyTrend[0], averageClosePrice: null },
      ]),
    ).toMatchObject({
      direction: "insufficient-data",
      changePercent: null,
    });
  });
});

describe("formatMarketStats", () => {
  it("formats every required market metric", () => {
    const message = formatMarketStats(report);

    expect(message).toContain("Market report: Irvine");
    expect(message).toContain("Residential sales: 1,250");
    expect(message).toContain("Median close price: $1,325,000");
    expect(message).toContain("Average close price: $1,450,000");
    expect(message).toContain("Average price per sq ft: $725/sq ft");
    expect(message).toContain("Average days on market: 24.2 days");
    expect(message).toContain(
      "List-to-close ratio: 99.2% (0.8% below list price)",
    );
    expect(message).toContain(
      "Price trend: Rising by 5.0% from 2025-05 to 2026-04",
    );
  });

  it("returns a helpful message when no sales are found", () => {
    const message = formatMarketStats({
      ...report,
      summary: {
        ...report.summary,
        city: "Unknown City",
        soldCount: 0,
      },
    });

    expect(message).toBe(
      "I couldn't find recent residential sales in Unknown City during the last 12 months.",
    );
  });

  it("shows unavailable instead of displaying null values", () => {
    const message = formatMarketStats({
      summary: {
        ...report.summary,
        averageClosePrice: null,
        medianClosePrice: null,
        averagePricePerSqft: null,
        averageDaysOnMarket: null,
        listToClosePercent: null,
      },
      monthlyTrend: [],
    });

    expect(message).toContain("Median close price: Not available");
    expect(message).toContain("Average close price: Not available");
    expect(message).toContain("Average price per sq ft: Not available");
    expect(message).toContain("Average days on market: Not available");
    expect(message).toContain("List-to-close ratio: Not available");
    expect(message).toContain("Price trend: Not enough monthly data");
  });
});

describe("formatCurrency", () => {
  it("formats valid currency and rejects invalid values", () => {
    expect(formatCurrency(850_000)).toBe("$850,000");
    expect(formatCurrency(null)).toBe("Not available");
    expect(formatCurrency(Number.NaN)).toBe("Not available");
  });
});
