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

interface RawMedianClosePriceRow {
  medianClosePrice: number | string | null;
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
    LIMIT 50
  `.trim();

  return {
    sql,
    params: [city.trim(), safeMonths],
  };
}

export function buildMedianClosePriceQuery(
  city: string,
  months = 12,
): MarketQuery {
  const safeMonths = normalizeMonths(months);

  const sql = `
    SELECT AVG(ranked.ClosePrice) AS medianClosePrice
    FROM (
      SELECT
        ClosePrice,
        ROW_NUMBER() OVER (ORDER BY ClosePrice) AS rowNumber,
        COUNT(*) OVER () AS rowCount
      FROM california_sold
      WHERE LOWER(TRIM(City)) = LOWER(TRIM(?))
        AND PropertyType = "Residential"
        AND ClosePrice > 0
        AND STR_TO_DATE(CloseDate, "%Y-%m-%d")
          >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
    ) AS ranked
    WHERE ranked.rowNumber IN (
      FLOOR((ranked.rowCount + 1) / 2),
      FLOOR((ranked.rowCount + 2) / 2)
    )
  `.trim();

  return {
    sql,
    params: [city.trim(), safeMonths],
  };
}

export function buildMonthlyTrendQuery(
  city: string,
  months = 12,
  offset = 0,
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
    LIMIT 50
    OFFSET ?
  `.trim();

  return {
    sql,
    params: [city.trim(), safeMonths, Math.max(0, Math.floor(offset))],
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
  const medianQuery = buildMedianClosePriceQuery(
    normalizedCity,
    safeMonths,
  );

  const [summaryRows, medianRows] = await Promise.all([
    query<RawMarketSummaryRow>(
      summaryQuery.sql,
      summaryQuery.params,
    ),
    query<RawMedianClosePriceRow>(
      medianQuery.sql,
      medianQuery.params,
    ),
  ]);

  const summary = summaryRows[0];

  return {
    city: normalizedCity,
    months: safeMonths,
    soldCount: Number(summary?.soldCount ?? 0),
    averageClosePrice: toNullableNumber(
      summary?.averageClosePrice,
    ),
    medianClosePrice: toNullableNumber(
      medianRows[0]?.medianClosePrice,
    ),
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

  const rows: RawMonthlyTrendRow[] = [];
  // A 60-month window can touch 61 calendar months; retain recent rows while
  // keeping every individual query bounded to 50 rows.
  for (let offset = 0; offset <= normalizeMonths(months); offset += 50) {
    const trendQuery = buildMonthlyTrendQuery(normalizedCity, months, offset);
    const page = await query<RawMonthlyTrendRow>(trendQuery.sql, trendQuery.params);
    rows.push(...page);
    if (page.length < 50) break;
  }

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
