import { getMarketStatsReport } from "../../db/marketStats";
import type { MarketStatsReport } from "../../types/marketStats";
import { formatMarketStats } from "./formatMarketStats";
import {
  parseMarketQuery,
  type ParsedMarketQuery,
} from "./parseMarketQuery";

export type MarketStatsSkillStatus =
  | "success"
  | "needs-city"
  | "error";

export interface MarketStatsSkillResult {
  status: MarketStatsSkillStatus;
  message: string;
  filters: ParsedMarketQuery;
  report: MarketStatsReport | null;
}

/**
 * Week 5 Market Statistics Skill.
 *
 * Flow:
 * 1. Parse the city and date range from the user's message.
 * 2. Ask for a city if one was not provided.
 * 3. Query california_sold.
 * 4. Format the result as a user-facing market report.
 */
export async function marketStatsSkill(
  userQuery: string,
): Promise<MarketStatsSkillResult> {
  const filters = parseMarketQuery(userQuery);

  if (!filters.city) {
    return {
      status: "needs-city",
      message:
        "Which California city would you like market statistics for?",
      filters,
      report: null,
    };
  }

  try {
    const report = await getMarketStatsReport(
      filters.city,
      filters.months,
    );

    return {
      status: "success",
      message: formatMarketStats(report),
      filters,
      report,
    };
  } catch {
    return {
      status: "error",
      message:
        `I couldn't retrieve market statistics for ` +
        `${filters.city}. Please try again.`,
      filters,
      report: null,
    };
  }
}

export {
  formatMarketStats,
  getMarketStatsReport,
  parseMarketQuery,
};