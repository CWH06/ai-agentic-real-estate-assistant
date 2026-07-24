import { searchActiveListings } from "../../db/listingSearch";
import { formatPropertyCards } from "./formatListings";
import type { PropertyCard } from "./formatListings";
import { getFollowUpQuestion } from "./followUp";
import { mergeFilters } from "./mergeFilters";
import { parsePropertyQuery } from "./parsePropertyQuery";
import { clearSession, getSession, updateSession } from "./session";

export interface PropertySearchResponse {
  message: string;
  done: boolean;
}

export async function handlePropertySearch(
  sessionId: string,
  userInput: string,
): Promise<PropertySearchResponse> {
  const normalized = userInput.trim().toLowerCase();

  if (normalized === "reset" || normalized === "start over") {
    clearSession(sessionId);
    return {
      message: "Okay, I cleared your search. What city are you looking in?",
      done: false,
    };
  }

  const session = getSession(sessionId);
  const newFilters = parsePropertyQuery(userInput);
  const mergedFilters = mergeFilters(session.filters, newFilters);

  updateSession(sessionId, {
    filters: mergedFilters,
    conversationStep: session.conversationStep + 1,
  });

  const followUpQuestion = getFollowUpQuestion(mergedFilters);
  if (followUpQuestion) {
    return { message: followUpQuestion, done: false };
  }

  const rows = await searchActiveListings(mergedFilters, 1, 5);
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

function formatConversationResults(listings: PropertyCard[]): string {
  const lines = listings.map((listing, index) => {
    return [
      `${index + 1}. ${listing.address}, ${listing.city ?? ""}`,
      listing.summary,
      `Photos: ${listing.facts.photoCount ?? 0}`,
    ].join("\n");
  });

  return `I found ${listings.length} matching listings:\n\n${lines.join("\n\n")}`;
}
