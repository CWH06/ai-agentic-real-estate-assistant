import { marketStatsSkill } from "../skills/market-stats";
import { handlePropertySearch } from "../skills/property-search/conversation";
import { recommendationSkill } from "../skills/recommendations";
import { ragSkill } from "../skills/rag";
import { semanticSearchSkill } from "../skills/semantic-search";

export type ChatIntent =
  | "help"
  | "market-stats"
  | "knowledge"
  | "recommendations"
  | "semantic-search"
  | "property-search";

export interface ChatMessage {
  userId: string;
  text: string;
}

export interface ChatReply {
  userId: string;
  text: string;
  intent: ChatIntent;
}

const HELP_TEXT = [
  "Try one of these:",
  "- Find homes in Irvine under 2M",
  "- Market stats for Irvine over 12 months",
  "- What does DOM mean?",
  "- What columns are in california_sold?",
  "- What is a list-to-close ratio?",
  "- Semantic search: charming craftsman with mountain views",
  "- Recommend similar to 1118398412",
].join("\n");

function normalize(text: string): string {
  return text.trim();
}

function extractRecommendationListingId(text: string): string | null {
  const match = text.match(
    /\b(?:recommend(?:ations)?|similar|like|more like|similar to)\b.*?\b(\d{3,})\b/i,
  ) ?? text.match(/\b(?:listing|mls)\s*#?\s*(\d{3,})\b/i);

  return match?.[1] ?? null;
}

function stripSemanticPrefix(text: string): string {
  return text
    .replace(/^\s*(?:semantic search|semantic|vector search|find similar|find something like)\s*:?\s*/i, "")
    .trim();
}

function isKnowledgeQuestion(text: string): boolean {
  const hasKnowledgeTerm = /\b(?:dom|days on market|list[- ]to[- ]close|escrow|cap rate|capitalization rate|comps?|comparable sales?|hoa|association fee|median price|price per square foot|inventory|california_sold|rets_property|mls (?:field|column|schema)|school district mapping|disclosure|agency relationship)\b/i
    .test(text);
  const asksForExplanation = /\b(?:what (?:does|is|are)|define|definition|explain|meaning|which (?:columns|fields)|columns? (?:are|does)|fields? (?:are|does)|schema)\b/i
    .test(text);

  return hasKnowledgeTerm && asksForExplanation;
}

export function detectChatIntent(text: string): ChatIntent {
  const normalized = normalize(text);
  const lower = normalized.toLowerCase();

  if (!normalized || lower === "help" || lower === "?") {
    return "help";
  }

  if (extractRecommendationListingId(normalized)) {
    return "recommendations";
  }

  // Knowledge questions must be checked before market keywords such as DOM.
  if (isKnowledgeQuestion(normalized)) {
    return "knowledge";
  }

  if (
    /\b(market|median|average|price per sq(?:uare)? foot|price per sqft|days on market|dom|trend|sold comps|comps)\b/i
      .test(normalized)
  ) {
    return "market-stats";
  }

  if (
    /\b(semantic search|vector search|find similar|find something like)\b/i.test(normalized)
    || /\b(charming|craftsman|character|modern|resort|amenities|mountain views|ocean views|quiet retreat|open floor plan)\b/i
      .test(normalized)
  ) {
    return "semantic-search";
  }

  return "property-search";
}

export async function handleChatMessage(
  message: ChatMessage,
): Promise<ChatReply> {
  const text = normalize(message.text);
  const intent = detectChatIntent(text);

  if (intent === "help") {
    return {
      userId: message.userId,
      text: HELP_TEXT,
      intent,
    };
  }

  if (intent === "market-stats") {
    const result = await marketStatsSkill(text);
    return {
      userId: message.userId,
      text: result.message,
      intent,
    };
  }

  if (intent === "knowledge") {
    const result = await ragSkill(text);
    return {
      userId: message.userId,
      text: result.message,
      intent,
    };
  }

  if (intent === "recommendations") {
    const listingId = extractRecommendationListingId(text);
    const result = await recommendationSkill(listingId ?? "");
    return {
      userId: message.userId,
      text: result.message,
      intent,
    };
  }

  if (intent === "semantic-search") {
    const result = await semanticSearchSkill(stripSemanticPrefix(text));
    return {
      userId: message.userId,
      text: result.message,
      intent,
    };
  }

  const result = await handlePropertySearch(message.userId, text);
  return {
    userId: message.userId,
    text: result.message,
    intent,
  };
}
