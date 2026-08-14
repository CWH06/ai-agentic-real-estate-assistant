import {
  countListingEmbeddings,
} from "../../db/semanticSearch";
import {
  getListingRecommendations,
  type ListingRecommendationResult,
  type RecommendationOptions,
} from "../../db/recommendations";
import type { CompValidation, RecommendationScore } from "../../types/recommendations";
import type { PropertyCard } from "../property-search/formatListings";
import { formatListingIdentifier, formatPropertyCards } from "../property-search/formatListings";

export type RecommendationSkillStatus =
  | "success"
  | "needs-listing"
  | "not-indexed"
  | "not-found"
  | "no-results"
  | "error";

export interface RecommendedPropertyCard extends PropertyCard {
  recommendation: RecommendationScore;
  compValidation: CompValidation;
}

export interface RecommendationSkillResult {
  status: RecommendationSkillStatus;
  message: string;
  listingId: string;
  target: PropertyCard | null;
  recommendations: RecommendedPropertyCard[];
}

function formatAssessment(assessment: CompValidation["assessment"]): string {
  switch (assessment) {
    case "below-comps":
      return "priced below recent comps";
    case "slightly-below-comps":
      return "priced slightly below recent comps";
    case "near-comps":
      return "priced near recent comps";
    case "slightly-above-comps":
      return "priced slightly above recent comps";
    case "above-comps":
      return "priced above recent comps";
    case "insufficient-comps":
      return "not enough recent comps";
  }
}

export function formatRecommendationCards(
  result: ListingRecommendationResult,
): {
  target: PropertyCard;
  recommendations: RecommendedPropertyCard[];
} {
  const [target] = formatPropertyCards([result.target]);
  const recommendationCards = formatPropertyCards(result.recommendations);

  return {
    target,
    recommendations: recommendationCards.map((card, index) => ({
      ...card,
      recommendation: result.recommendations[index].recommendation,
      compValidation: result.recommendations[index].compValidation,
    })),
  };
}

export function formatRecommendationMessage(
  recommendations: RecommendedPropertyCard[],
): string {
  if (recommendations.length === 0) {
    return "I could not find similar active listings for that property.";
  }

  const lines = recommendations.map((listing, index) => {
    const comp = listing.compValidation;
    const score = listing.recommendation.totalScore.toFixed(1);
    const semantic = Math.round(listing.recommendation.semanticSimilarity * 1_000) / 10;
    const compLine = comp.compPrice
      ? `${formatAssessment(comp.assessment)} at about $${comp.compPrice.toLocaleString()} comp value (${comp.compCount} comps)`
      : formatAssessment(comp.assessment);

    return [
      `${index + 1}. ${listing.address}, ${listing.city ?? ""}`,
      formatListingIdentifier(listing),
      listing.summary,
      `Score: ${score}/100 | Semantic match: ${semantic}%`,
      `Price check: ${compLine}`,
    ].join("\n");
  });

  return `Top ${recommendations.length} similar active listings:\n\n${lines.join("\n\n")}`;
}

/**
 * Week 7 Recommendation Skill.
 *
 * Flow:
 * 1. Accept a liked listing id or display id.
 * 2. Compare active listings with a 60-point structured score and
 *    a 40-point embedding score.
 * 3. Validate each recommendation against recent sold comps.
 */
export async function recommendationSkill(
  listingId: string,
  options: RecommendationOptions = {},
): Promise<RecommendationSkillResult> {
  const normalizedListingId = listingId.trim();

  if (!normalizedListingId) {
    return {
      status: "needs-listing",
      message: "Which listing should I use as the recommendation seed?",
      listingId: normalizedListingId,
      target: null,
      recommendations: [],
    };
  }

  try {
    const indexedCount = await countListingEmbeddings(options.model);
    if (indexedCount === 0) {
      return {
        status: "not-indexed",
        message: "Recommendations need listing embeddings. Run npm run embeddings:index first.",
        listingId: normalizedListingId,
        target: null,
        recommendations: [],
      };
    }

    const result = await getListingRecommendations(normalizedListingId, options);

    if (!result) {
      return {
        status: "not-found",
        message:
          "I could not find an active indexed listing for that listing id.",
        listingId: normalizedListingId,
        target: null,
        recommendations: [],
      };
    }

    const { target, recommendations } = formatRecommendationCards(result);

    if (recommendations.length === 0) {
      return {
        status: "no-results",
        message: formatRecommendationMessage(recommendations),
        listingId: normalizedListingId,
        target,
        recommendations,
      };
    }

    return {
      status: "success",
      message: formatRecommendationMessage(recommendations),
      listingId: normalizedListingId,
      target,
      recommendations,
    };
  } catch {
    return {
      status: "error",
      message:
        "I couldn't build recommendations right now. Please try again.",
      listingId: normalizedListingId,
      target: null,
      recommendations: [],
    };
  }
}

export {
  getListingRecommendations,
};
