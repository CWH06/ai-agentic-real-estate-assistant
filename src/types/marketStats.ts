/**
 * Aggregated market statistics for one California city.
 */
export interface CityMarketSummary {
  city: string;
  months: number;
  soldCount: number;

  averageClosePrice: number | null;
  medianClosePrice: number | null;
  averagePricePerSqft: number | null;
  averageDaysOnMarket: number | null;
  listToClosePercent: number | null;
}

/**
 * Market statistics for one calendar month.
 *
 * The month value uses YYYY-MM format, for example "2026-04".
 */
export interface MonthlyMarketTrend {
  month: string;
  soldCount: number;

  averageClosePrice: number | null;
  averagePricePerSqft: number | null;
  averageDaysOnMarket: number | null;
}

/**
 * Complete result returned by the market statistics database layer.
 */
export interface MarketStatsReport {
  summary: CityMarketSummary;
  monthlyTrend: MonthlyMarketTrend[];
}