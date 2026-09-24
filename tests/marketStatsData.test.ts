import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("../src/db/mysql", () => ({
  query: queryMock,
}));

import {
  getCityMarketSummary,
  getCityMonthlyTrend,
} from "../src/db/marketStats";

describe("market statistics database result handling", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("normalizes MySQL aggregate and median values", async () => {
    queryMock
      .mockResolvedValueOnce([
        {
          soldCount: "4",
          averageClosePrice: "775000",
          averagePricePerSqft: "625.5",
          averageDaysOnMarket: "23.25",
          listToClosePercent: "98.75",
        },
      ])
      .mockResolvedValueOnce([
        { medianClosePrice: "750000" },
      ]);

    await expect(
      getCityMarketSummary("  Irvine  ", 12),
    ).resolves.toEqual({
      city: "Irvine",
      months: 12,
      soldCount: 4,
      averageClosePrice: 775_000,
      medianClosePrice: 750_000,
      averagePricePerSqft: 625.5,
      averageDaysOnMarket: 23.25,
      listToClosePercent: 98.75,
    });
  });

  it("returns safe empty values when the city has no sales", async () => {
    queryMock
      .mockResolvedValueOnce([
        {
          soldCount: 0,
          averageClosePrice: null,
          averagePricePerSqft: null,
          averageDaysOnMarket: null,
          listToClosePercent: null,
        },
      ])
      .mockResolvedValueOnce([
        { medianClosePrice: null },
      ]);

    await expect(
      getCityMarketSummary("Unknown City", 12),
    ).resolves.toMatchObject({
      soldCount: 0,
      averageClosePrice: null,
      medianClosePrice: null,
      averagePricePerSqft: null,
      averageDaysOnMarket: null,
      listToClosePercent: null,
    });
  });

  it("normalizes monthly trend rows returned by MySQL", async () => {
    queryMock.mockResolvedValueOnce([
      {
        month: "2026-03",
        soldCount: "10",
        averageClosePrice: "900000",
        averagePricePerSqft: "600.25",
        averageDaysOnMarket: "20.5",
      },
      {
        month: "2026-04",
        soldCount: 12,
        averageClosePrice: null,
        averagePricePerSqft: null,
        averageDaysOnMarket: "18",
      },
    ]);

    await expect(
      getCityMonthlyTrend("Pasadena", 12),
    ).resolves.toEqual([
      {
        month: "2026-03",
        soldCount: 10,
        averageClosePrice: 900_000,
        averagePricePerSqft: 600.25,
        averageDaysOnMarket: 20.5,
      },
      {
        month: "2026-04",
        soldCount: 12,
        averageClosePrice: null,
        averagePricePerSqft: null,
        averageDaysOnMarket: 18,
      },
    ]);
  });

  it("rejects an empty city before querying MySQL", async () => {
    await expect(
      getCityMarketSummary("   ", 12),
    ).rejects.toThrow("City is required");

    await expect(
      getCityMonthlyTrend("", 12),
    ).rejects.toThrow("City is required");

    expect(queryMock).not.toHaveBeenCalled();
  });

  it("retains the newest months when the window exceeds 50 grouped rows", async () => {
    const rows = Array.from({ length: 61 }, (_, i) => ({
      month: new Date(Date.UTC(2021, i, 1)).toISOString().slice(0, 7),
      soldCount: 2, averageClosePrice: 900000, averagePricePerSqft: 600, averageDaysOnMarket: 20,
    }));
    queryMock.mockResolvedValueOnce(rows.slice(0, 50)).mockResolvedValueOnce(rows.slice(50));
    const result = await getCityMonthlyTrend("Irvine", 60);
    expect(result).toHaveLength(61);
    expect(result.at(-1)?.month).toBe("2026-01");
    expect(queryMock.mock.calls.map((call) => call[1])).toEqual([["Irvine", 60, 0], ["Irvine", 60, 50]]);
  });
});
