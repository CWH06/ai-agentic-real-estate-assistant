import {
  countListingEmbeddings,
  searchSemanticListings,
  type SemanticListingMatch,
  type SemanticSearchOptions,
} from "../../db/semanticSearch";
import type { PropertyCard } from "../property-search/formatListings";
import { formatListingIdentifier, formatPropertyCards } from "../property-search/formatListings";

export type SemanticSearchSkillStatus =
  | "success"
  | "needs-query"
  | "not-indexed"
  | "no-results"
  | "error";

export interface SemanticPropertyCard extends PropertyCard {
  similarity: number;
}

export interface SemanticSearchSkillResult {
  status: SemanticSearchSkillStatus;
  message: string;
  query: string;
  listings: SemanticPropertyCard[];
}

export function formatSemanticResults(
  matches: SemanticListingMatch[],
): SemanticPropertyCard[] {
  const cards = formatPropertyCards(matches);
  return cards.map((card, index) => ({
    ...card,
    similarity: matches[index].similarity,
  }));
}

export function formatSemanticSearchMessage(
  listings: SemanticPropertyCard[],
): string {
  if (listings.length === 0) {
    return "I could not find semantic matches for that description.";
  }

  const lines = listings.map((listing, index) => {
    const score = Math.round(listing.similarity * 1_000) / 10;
    return [
      `${index + 1}. ${listing.address}, ${listing.city ?? ""}`,
      formatListingIdentifier(listing),
      listing.summary,
      `Similarity: ${score}%`,
    ].join("\n");
  });

  return `I found ${listings.length} semantically similar listings:\n\n${lines.join("\n\n")}`;
}

/**
 * Week 6 Semantic Property Search Skill.
 *
 * Flow:
 * 1. Embed the user's free-text property description.
 * 2. Compare it against indexed active listing embeddings.
 * 3. Return the top semantic matches as formatted property cards.
 */
export async function semanticSearchSkill(
  userQuery: string,
  options: SemanticSearchOptions = {},
): Promise<SemanticSearchSkillResult> {
  const normalizedQuery = userQuery.trim();

  if (!normalizedQuery) {
    return {
      status: "needs-query",
      message: "What kind of property are you looking for?",
      query: normalizedQuery,
      listings: [],
    };
  }

  try {
    const indexedCount = await countListingEmbeddings(options.model);
    if (indexedCount === 0) {
      return {
        status: "not-indexed",
        message: "Semantic search is not indexed yet. Run npm run embeddings:index first.",
        query: normalizedQuery,
        listings: [],
      };
    }

    const matches = await searchSemanticListings(normalizedQuery, options);
    const listings = formatSemanticResults(matches);

    if (listings.length === 0) {
      return {
        status: "no-results",
        message: formatSemanticSearchMessage(listings),
        query: normalizedQuery,
        listings,
      };
    }

    return {
      status: "success",
      message: formatSemanticSearchMessage(listings),
      query: normalizedQuery,
      listings,
    };
  } catch {
    return {
      status: "error",
      message:
        "I couldn't run semantic property search right now. Please try again.",
      query: normalizedQuery,
      listings: [],
    };
  }
}

export {
  countListingEmbeddings,
  searchSemanticListings,
};
