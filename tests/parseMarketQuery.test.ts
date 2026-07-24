import { describe, expect, it } from "vitest";
import { parseMarketQuery } from "../src/skills/market-stats/parseMarketQuery";

describe("parseMarketQuery", () => {
  it("parses a city after in", () => {
    expect(
      parseMarketQuery(
        "What is the median home price in Pasadena?",
      ),
    ).toEqual({
      city: "Pasadena",
      months: 12,
    });
  });

  it("parses a multi-word city and month range", () => {
    expect(
      parseMarketQuery(
        "Show me market statistics for San Diego over 6 months",
      ),
    ).toEqual({
      city: "San Diego",
      months: 6,
    });
  });

  it("parses a possessive housing market question", () => {
    expect(
      parseMarketQuery(
        "How is Irvine's housing market?",
      ),
    ).toEqual({
      city: "Irvine",
      months: 12,
    });
  });

  it("parses a city at the start of the query", () => {
    expect(
      parseMarketQuery(
        "Irvine market trend for the last 24 months",
      ),
    ).toEqual({
      city: "Irvine",
      months: 24,
    });
  });

  it("converts years into months", () => {
    expect(
      parseMarketQuery(
        "Show me the market for the last 2 years in Los Angeles",
      ),
    ).toEqual({
      city: "Los Angeles",
      months: 24,
    });
  });

  it("uses 12 months when no date range is provided", () => {
    expect(
      parseMarketQuery(
        "What is the average price in Sacramento?",
      ),
    ).toEqual({
      city: "Sacramento",
      months: 12,
    });
  });

  it("returns null when the city is missing", () => {
    expect(
      parseMarketQuery(
        "Are home prices rising over 6 months?",
      ),
    ).toEqual({
      city: null,
      months: 6,
    });
  });

  it("returns defaults for an empty query", () => {
    expect(parseMarketQuery("")).toEqual({
      city: null,
      months: 12,
    });
  });

  it("limits the maximum range to 60 months", () => {
    expect(
      parseMarketQuery(
        "Show me the market in Oakland over 120 months",
      ),
    ).toEqual({
      city: "Oakland",
      months: 60,
    });
  });

  it("limits the minimum range to one month", () => {
    expect(
      parseMarketQuery(
        "Show me the market in Fresno over 0 months",
      ),
    ).toEqual({
      city: "Fresno",
      months: 1,
    });
  });

  it("parses a real estate market phrase", () => {
    expect(
      parseMarketQuery(
        "Tell me about Santa Monica real estate market",
      ),
    ).toEqual({
      city: "Santa Monica",
      months: 12,
    });
  });
});