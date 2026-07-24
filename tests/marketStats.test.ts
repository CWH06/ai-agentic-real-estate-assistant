import { describe, expect, it } from "vitest";
import {
  buildClosePricesQuery,
  buildMarketSummaryQuery,
  buildMonthlyTrendQuery,
  calculateMedian,
  normalizeMonths,
} from "../src/db/marketStats";

describe("normalizeMonths", () => {
  it("keeps a valid month range", () => {
    expect(normalizeMonths(12)).toBe(12);
    expect(normalizeMonths(24)).toBe(24);
  });

  it("limits the range between 1 and 60 months", () => {
    expect(normalizeMonths(0)).toBe(1);
    expect(normalizeMonths(-12)).toBe(1);
    expect(normalizeMonths(120)).toBe(60);
  });

  it("uses 12 months for a non-finite value", () => {
    expect(normalizeMonths(Number.NaN)).toBe(12);
    expect(normalizeMonths(Number.POSITIVE_INFINITY)).toBe(12);
  });

  it("removes decimal months", () => {
    expect(normalizeMonths(12.9)).toBe(12);
  });
});

describe("calculateMedian", () => {
  it("calculates the median for an odd number of prices", () => {
    expect(
      calculateMedian([
        900_000,
        700_000,
        800_000,
      ]),
    ).toBe(800_000);
  });

  it("calculates the median for an even number of prices", () => {
    expect(
      calculateMedian([
        600_000,
        900_000,
        700_000,
        800_000,
      ]),
    ).toBe(750_000);
  });

  it("ignores invalid and non-positive prices", () => {
    expect(
      calculateMedian([
        0,
        -100,
        Number.NaN,
        700_000,
        900_000,
      ]),
    ).toBe(800_000);
  });

  it("returns null when no valid prices exist", () => {
    expect(
      calculateMedian([
        0,
        -100,
        Number.NaN,
      ]),
    ).toBeNull();

    expect(calculateMedian([])).toBeNull();
  });
});

describe("market statistics SQL builders", () => {
  it("builds a parameterized summary query", () => {
    const result = buildMarketSummaryQuery(
      "  Irvine  ",
      12,
    );

    expect(result.params).toEqual([
      "Irvine",
      12,
    ]);

    expect(result.sql).toContain(
      "FROM california_sold",
    );

    expect(result.sql).toContain(
      "LOWER(TRIM(City)) = LOWER(TRIM(?))",
    );

    expect(result.sql).toContain(
      "ClosePrice > 0",
    );

    expect(result.sql).not.toContain("Irvine");
  });

  it("builds a close-price query for median calculation", () => {
    const result = buildClosePricesQuery(
      "Pasadena",
      6,
    );

    expect(result.params).toEqual([
      "Pasadena",
      6,
    ]);

    expect(result.sql).toContain(
      "SELECT ClosePrice",
    );

    expect(result.sql).toContain(
      "ORDER BY ClosePrice ASC",
    );
  });

  it("builds a monthly trend query", () => {
    const result = buildMonthlyTrendQuery(
      "San Diego",
      24,
    );

    expect(result.params).toEqual([
      "San Diego",
      24,
    ]);

    expect(result.sql).toContain(
      'DATE_FORMAT(',
    );

    expect(result.sql).toContain(
      'GROUP BY DATE_FORMAT(',
    );

    expect(result.sql).toContain(
      "ORDER BY month ASC",
    );
  });

  it("limits months before adding them to SQL parameters", () => {
    const result = buildMarketSummaryQuery(
      "Sacramento",
      500,
    );

    expect(result.params).toEqual([
      "Sacramento",
      60,
    ]);
  });

  it("does not insert the city directly into SQL", () => {
    const unsafeCity =
      'Irvine" OR 1 = 1 --';

    const result = buildMarketSummaryQuery(
      unsafeCity,
      12,
    );

    expect(result.sql).not.toContain(unsafeCity);
    expect(result.params).toEqual([
      unsafeCity,
      12,
    ]);
  });
});