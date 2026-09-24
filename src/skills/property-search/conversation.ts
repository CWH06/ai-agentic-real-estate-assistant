import { searchActiveListings } from "../../db/listingSearch";
import { formatListingIdentifier, formatPropertyCards } from "./formatListings";
import type { PropertyCard } from "./formatListings";
import { getFollowUpQuestion } from "./followUp";
import { mergeFilters } from "./mergeFilters";
import { parsePropertyQuery } from "./parsePropertyQuery";
import { clearSession, getSession, updateSession } from "./session";
import type { PropertyFilters } from "../../types/propertyFilters";

export interface PropertySearchResponse {
  message: string;
  done: boolean;
}

export async function handlePropertySearch(
  sessionId: string,
  userInput: string,
  searchListings: typeof searchActiveListings = searchActiveListings,
): Promise<PropertySearchResponse> {
  const normalized = userInput.trim();

  if (isResetRequest(normalized)) {
    clearSession(sessionId);
    return {
      message: "Okay, I cleared your search. What city are you looking in?",
      done: false,
    };
  }

  const newFilters = parsePropertyQuery(userInput);
  let session = getSession(sessionId);

  if (shouldStartFreshSearch(session.filters, session.conversationStep, newFilters, userInput)) {
    clearSession(sessionId);
    session = getSession(sessionId);
  }

  applyContextualFollowUpFilters(session.filters, newFilters, userInput);
  const mergedFilters = mergeFilters(session.filters, newFilters);

  updateSession(sessionId, {
    filters: mergedFilters,
    conversationStep: session.conversationStep + 1,
  });

  const followUpQuestion = getFollowUpQuestion(mergedFilters);
  if (followUpQuestion) {
    return { message: followUpQuestion, done: false };
  }

  const rows = await searchListings(mergedFilters, 1, 5);
  const formattedListings = formatPropertyCards(rows);

  updateSession(sessionId, { lastResults: formattedListings });

  if (formattedListings.length === 0) {
    return {
      message: "I couldn't find matching listings. Try changing the city, budget, or property type.",
      done: true,
    };
  }

  return {
    message: formatConversationResults(formattedListings),
    done: true,
  };
}

function applyContextualFollowUpFilters(
  currentFilters: PropertyFilters,
  newFilters: PropertyFilters,
  userInput: string,
): void {
  if (!newFilters.maxPrice) {
    const budget = parseBudgetReply(
      userInput,
      !currentFilters.maxPrice,
    );
    if (budget) {
      newFilters.maxPrice = budget;
    }
  }

  if (
    currentFilters.maxPrice
    && currentFilters.type
    && !currentFilters.beds
    && !newFilters.beds
  ) {
    const beds = parseBedroomsReply(userInput);
    if (beds) {
      newFilters.beds = beds;
    }
  }
}

function parseBudgetReply(
  text: string,
  allowPlainNumber: boolean,
): number | null {
  const normalized = text.trim();
  const match = normalized.match(/^\$?\s*([\d,.]+)\s*([kKmM])?$/);
  if (!match) return null;

  const hasPriceSignal =
    normalized.includes("$")
    || normalized.includes(",")
    || Boolean(match[2]);
  if (!allowPlainNumber && !hasPriceSignal) return null;

  let amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") amount *= 1_000;
  if (suffix === "m") amount *= 1_000_000;

  return Math.round(amount);
}

function parseBedroomsReply(text: string): number | null {
  const match = text.trim().match(/^(\d+)$/);
  if (!match) return null;

  const beds = Number(match[1]);
  if (!Number.isInteger(beds) || beds < 1 || beds > 20) return null;
  return beds;
}

function formatConversationResults(listings: PropertyCard[]): string {
  const lines = listings.map((listing, index) => {
    return [
      `${index + 1}. ${listing.address}, ${listing.city ?? ""}`,
      formatListingIdentifier(listing),
      listing.summary,
      `Photos: ${listing.facts.photoCount ?? 0}`,
    ].join("\n");
  });

  return `I found ${listings.length} matching listings:\n\n${lines.join("\n\n")}`;
}

function isResetRequest(text: string): boolean {
  return /^(?:reset|start over|restart|clear search|new search)$/i.test(text.trim());
}

function shouldStartFreshSearch(
  currentFilters: PropertyFilters,
  conversationStep: number,
  newFilters: PropertyFilters,
  userInput: string,
): boolean {
  if (conversationStep === 0) return false;
  if (getFollowUpQuestion(currentFilters)) return false;
  if (!newFilters.city) return false;

  return /\b(?:find|show|search|homes|houses|condos|townhomes|properties|listings|affordable)\b/i
    .test(userInput);
}
