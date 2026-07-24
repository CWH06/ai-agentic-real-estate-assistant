import type {
  MarketStatsReport,
  MonthlyMarketTrend,
} from "../../types/marketStats";

export type PriceTrendDirection =
  | "rising"
  | "falling"
  | "stable"
  | "insufficient-data";

export interface PriceTrendAssessment {
  direction: PriceTrendDirection;
  changePercent: number | null;
  earliestMonth: string | null;
  latestMonth: string | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

/**
 * Format a market statistics report as a user-facing message.
 */
export function formatMarketStats(
  report: MarketStatsReport,
): string {
  const { summary, monthlyTrend } = report;

  if (summary.soldCount === 0) {
    return (
      `I couldn't find recent residential sales in ` +
      `${summary.city} during the last ${summary.months} months.`
    );
  }

  const trend = calculatePriceTrend(monthlyTrend);

  const lines = [
    `Market report: ${summary.city}`,
    `Period: Last ${summary.months} months`,
    `Residential sales: ${integerFormatter.format(summary.soldCount)}`,
    `Median close price: ${formatCurrency(summary.medianClosePrice)}`,
    `Average close price: ${formatCurrency(summary.averageClosePrice)}`,
    `Average price per sq ft: ${formatPricePerSqft(summary.averagePricePerSqft)}`,
    `Average days on market: ${formatDays(summary.averageDaysOnMarket)}`,
    `List-to-close ratio: ${formatRatio(summary.listToClosePercent)}`,
    `Price trend: ${formatTrendAssessment(trend)}`,
  ];

  return lines.join("\n");
}

/**
 * Compare the earliest and latest available monthly average prices.
 */
export function calculatePriceTrend(
  monthlyTrend: MonthlyMarketTrend[],
): PriceTrendAssessment {
  const validMonths = monthlyTrend.filter(
    (
      month,
    ): month is MonthlyMarketTrend & {
      averageClosePrice: number;
    } =>
      month.averageClosePrice !== null &&
      Number.isFinite(month.averageClosePrice) &&
      month.averageClosePrice > 0,
  );

  if (validMonths.length < 2) {
    return {
      direction: "insufficient-data",
      changePercent: null,
      earliestMonth: null,
      latestMonth: null,
    };
  }

  const earliest = validMonths[0];
  const latest = validMonths[validMonths.length - 1];

  const changePercent =
    ((latest.averageClosePrice - earliest.averageClosePrice) /
      earliest.averageClosePrice) *
    100;

  let direction: PriceTrendDirection = "stable";

  if (changePercent > 2) {
    direction = "rising";
  } else if (changePercent < -2) {
    direction = "falling";
  }

  return {
    direction,
    changePercent,
    earliestMonth: earliest.month,
    latestMonth: latest.month,
  };
}

export function formatCurrency(
  value: number | null,
): string {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return currencyFormatter.format(value);
}

function formatPricePerSqft(
  value: number | null,
): string {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${currencyFormatter.format(value)}/sq ft`;
}

function formatDays(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${value.toFixed(1)} days`;
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  const difference = value - 100;
  const formattedRatio = `${value.toFixed(1)}%`;

  if (Math.abs(difference) < 0.05) {
    return `${formattedRatio} (approximately at list price)`;
  }

  if (difference > 0) {
    return (
      `${formattedRatio} ` +
      `(${Math.abs(difference).toFixed(1)}% above list price)`
    );
  }

  return (
    `${formattedRatio} ` +
    `(${Math.abs(difference).toFixed(1)}% below list price)`
  );
}

function formatTrendAssessment(
  trend: PriceTrendAssessment,
): string {
  if (
    trend.direction === "insufficient-data" ||
    trend.changePercent === null
  ) {
    return "Not enough monthly data";
  }

  const absoluteChange = Math.abs(
    trend.changePercent,
  ).toFixed(1);

  if (trend.direction === "rising") {
    return (
      `Rising by ${absoluteChange}% ` +
      `from ${trend.earliestMonth} to ${trend.latestMonth}`
    );
  }

  if (trend.direction === "falling") {
    return (
      `Falling by ${absoluteChange}% ` +
      `from ${trend.earliestMonth} to ${trend.latestMonth}`
    );
  }

  return (
    `Stable (${trend.changePercent.toFixed(1)}%) ` +
    `from ${trend.earliestMonth} to ${trend.latestMonth}`
  );
}