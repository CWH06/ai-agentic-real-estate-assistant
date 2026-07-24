import { query } from "./mysql";
import type {
  CityMarketSummary,
  MarketStatsReport,
  MonthlyMarketTrend,
} from "../types/marketStats";

interface RawMarketSummaryRow {
  soldCount: number | string;
  averageClosePrice: number | string | null;
  averagePricePerSqft: number | string | null;
  averageDaysOnMarket: number | string | null;
  listToClosePercent: number | string | null;
}

interface RawClosePriceRow {
  ClosePrice: number | string;
}

interface RawMonthlyTrendRow {
  month: string;
  soldCount: number | string;
  averageClosePrice: number | string | null;
  averagePricePerSqft: number | string | null;
  averageDaysOnMarket: number | string | null;
}

export interface MarketQuery {
  sql: string;
  params: unknown[];
}

/**
 * Restrict the requested date range to a reasonable value.
 */
export function normalizeMonths(months: number): number {
  if (!Number.isFinite(months)) {
    return 12;
  }

  return Math.min(60, Math.max(1, Math.floor(months)));
}

/**
 * Convert MySQL aggregate values into JavaScript numbers.
 *
 * MySQL may return values from AVG() as strings, depending on
 * the underlying column type.
 */
function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const converted = Number(value);

  return Number.isFinite(converted) ? converted : null;
}

/**
 * Calculate the median from a list of close prices.
 */
export function calculateMedian(values: number[]): number | null {
  const validValues = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((first, second) => first - second);

  if (validValues.length === 0) {
    return null;
  }

  const middle = Math.floor(validValues.length / 2);

  if (validValues.length % 2 === 1) {
    return validValues[middle];
  }

  return (validValues[middle - 1] + validValues[middle]) / 2;
}

export function buildMarketSummaryQuery(
  city: string,
  months = 12,
): MarketQuery {
  const safeMonths = normalizeMonths(months);

  const sql = `
    SELECT
      COUNT(*) AS soldCount,
      AVG(ClosePrice) AS averageClosePrice,
      AVG(
        CASE
          WHEN LivingArea > 0
          THEN ClosePrice / LivingArea
          ELSE NULL
        END
      ) AS averagePricePerSqft,
      AVG(
        CASE
          WHEN DaysOnMarket >= 0
          THEN DaysOnMarket
          ELSE NULL
        END
      ) AS averageDaysOnMarket,
      AVG(
        CASE
          WHEN ListPrice > 0
          THEN ClosePrice / ListPrice * 100
          ELSE NULL
        END
      ) AS listToClosePercent
    FROM california_sold
    WHERE LOWER(TRIM(City)) = LOWER(TRIM(?))
      AND PropertyType = "Residential"
      AND ClosePrice > 0
      AND STR_TO_DATE(CloseDate, "%Y-%m-%d")
        >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
  `.trim();

  return {
    sql,
    params: [city.trim(), safeMonths],
  };
}

export function buildClosePricesQuery(
  city: string,
  months = 12,
): MarketQuery {
  const safeMonths = normalizeMonths(months);

  const sql = `
    SELECT ClosePrice
    FROM california_sold
    WHERE LOWER(TRIM(City)) = LOWER(TRIM(?))
      AND PropertyType = "Residential"
      AND ClosePrice > 0
      AND STR_TO_DATE(CloseDate, "%Y-%m-%d")
        >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
    ORDER BY ClosePrice ASC
  `.trim();

  return {
    sql,
    params: [city.trim(), safeMonths],
  };
}

export function buildMonthlyTrendQuery(
  city: string,
  months = 12,
): MarketQuery {
  const safeMonths = normalizeMonths(months);

  const sql = `
    SELECT
      DATE_FORMAT(
        STR_TO_DATE(CloseDate, "%Y-%m-%d"),
        "%Y-%m"
      ) AS month,
      COUNT(*) AS soldCount,
      AVG(ClosePrice) AS averageClosePrice,
      AVG(
        CASE
          WHEN LivingArea > 0
          THEN ClosePrice / LivingArea
          ELSE NULL
        END
      ) AS averagePricePerSqft,
      AVG(
        CASE
          WHEN DaysOnMarket >= 0
          THEN DaysOnMarket
          ELSE NULL
        END
      ) AS averageDaysOnMarket
    FROM california_sold
    WHERE LOWER(TRIM(City)) = LOWER(TRIM(?))
      AND PropertyType = "Residential"
      AND ClosePrice > 0
      AND STR_TO_DATE(CloseDate, "%Y-%m-%d")
        >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
    GROUP BY DATE_FORMAT(
      STR_TO_DATE(CloseDate, "%Y-%m-%d"),
      "%Y-%m"
    )
    ORDER BY month ASC
  `.trim();

  return {
    sql,
    params: [city.trim(), safeMonths],
  };
}

export async function getCityMarketSummary(
  city: string,
  months = 12,
): Promise<CityMarketSummary> {
  const normalizedCity = city.trim();

  if (!normalizedCity) {
    throw new Error("City is required for market statistics.");
  }

  const safeMonths = normalizeMonths(months);
  const summaryQuery = buildMarketSummaryQuery(
    normalizedCity,
    safeMonths,
  );
  const pricesQuery = buildClosePricesQuery(
    normalizedCity,
    safeMonths,
  );

  const [summaryRows, priceRows] = await Promise.all([
    query<RawMarketSummaryRow>(
      summaryQuery.sql,
      summaryQuery.params,
    ),
    query<RawClosePriceRow>(
      pricesQuery.sql,
      pricesQuery.params,
    ),
  ]);

  const summary = summaryRows[0];

  const closePrices = priceRows
    .map((row) => Number(row.ClosePrice))
    .filter((price) => Number.isFinite(price));

  return {
    city: normalizedCity,
    months: safeMonths,
    soldCount: Number(summary?.soldCount ?? 0),
    averageClosePrice: toNullableNumber(
      summary?.averageClosePrice,
    ),
    medianClosePrice: calculateMedian(closePrices),
    averagePricePerSqft: toNullableNumber(
      summary?.averagePricePerSqft,
    ),
    averageDaysOnMarket: toNullableNumber(
      summary?.averageDaysOnMarket,
    ),
    listToClosePercent: toNullableNumber(
      summary?.listToClosePercent,
    ),
  };
}

export async function getCityMonthlyTrend(
  city: string,
  months = 12,
): Promise<MonthlyMarketTrend[]> {
  const normalizedCity = city.trim();

  if (!normalizedCity) {
    throw new Error("City is required for market statistics.");
  }

  const trendQuery = buildMonthlyTrendQuery(
    normalizedCity,
    months,
  );

  const rows = await query<RawMonthlyTrendRow>(
    trendQuery.sql,
    trendQuery.params,
  );

  return rows.map((row) => ({
    month: row.month,
    soldCount: Number(row.soldCount),
    averageClosePrice: toNullableNumber(
      row.averageClosePrice,
    ),
    averagePricePerSqft: toNullableNumber(
      row.averagePricePerSqft,
    ),
    averageDaysOnMarket: toNullableNumber(
      row.averageDaysOnMarket,
    ),
  }));
}

export async function getMarketStatsReport(
  city: string,
  months = 12,
): Promise<MarketStatsReport> {
  const [summary, monthlyTrend] = await Promise.all([
    getCityMarketSummary(city, months),
    getCityMonthlyTrend(city, months),
  ]);

  return {
    summary,
    monthlyTrend,
  };
}