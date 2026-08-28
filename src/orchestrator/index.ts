import { marketStatsSkill } from "../skills/market-stats";
import { handlePropertySearch } from "../skills/property-search/conversation";
import { getFollowUpQuestion } from "../skills/property-search/followUp";
import { getSession } from "../skills/property-search/session";
import { recommendationSkill } from "../skills/recommendations";
import { ragSkill } from "../skills/rag";

export type OrchestratorIntent =
  | "search"
  | "market"
  | "recommend"
  | "knowledge"
  | "email-draft"
  | "mixed"
  | "fallback";

export interface AgentMessageResult {
  message: string;
}

export interface OrchestratorAgents {
  propertySearchAgent: (
    query: string,
    userId: string,
  ) => Promise<AgentMessageResult>;
  marketStatsAgent: (query: string) => Promise<AgentMessageResult>;
  recommendationAgent: (listingId: string) => Promise<AgentMessageResult>;
  ragAgent: (query: string) => Promise<AgentMessageResult>;
  emailDraftAgent: (
    query: string,
    userId: string,
  ) => Promise<AgentMessageResult>;
}

export interface OrchestratorPart {
  intent: Exclude<OrchestratorIntent, "mixed" | "fallback">;
  title: string;
  message: string;
}

export interface OrchestratorResult {
  userId: string;
  intent: OrchestratorIntent;
  message: string;
  parts: OrchestratorPart[];
}

export interface OrchestratorOptions {
  agents?: Partial<OrchestratorAgents>;
}

const FALLBACK_MESSAGE =
  "I'm not sure how to help with that. Try asking about properties, market trends, recommendations, or project knowledge.";
const ORCHESTRATION_ERROR_MESSAGE =
  "I couldn't complete that request right now. Check that MySQL is running and try again.";

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function hasKnowledgeQuestionShape(text: string): boolean {
  return /\b(?:what (?:does|is|are)|define|definition|explain|meaning|which (?:columns|fields)|columns? (?:are|does)|fields? (?:are|does)|schema)\b/i
    .test(text);
}

function hasKnowledgeTerm(text: string): boolean {
  return /\b(?:dom|days on market|list[- ]to[- ]close|escrow|cap rate|capitalization rate|comps?|comparable sales?|hoa|association fee|median price|price per square foot|inventory|california_sold|rets_property|mls (?:field|column|schema)|school district mapping|disclosure|agency relationship)\b/i
    .test(text);
}

function isKnowledgeQuestion(text: string): boolean {
  return hasKnowledgeQuestionShape(text) && hasKnowledgeTerm(text);
}

export function extractRecommendationListingId(text: string): string | null {
  const match = text.match(
    /\b(?:recommend(?:ations)?|similar|like|more like|similar to)\b.*?\b(\d{3,})\b/i,
  ) ?? text.match(/\b(?:listing|mls)\s*#?\s*(\d{3,})\b/i);

  return match?.[1] ?? null;
}

function isPropertySearchReset(text: string): boolean {
  return /^(?:reset|start over|restart|clear search|new search)$/i.test(text.trim());
}

export function classifyIntent(query: string): OrchestratorIntent {
  const text = normalize(query);
  if (!text) return "fallback";
  if (isPropertySearchReset(text)) return "search";

  const wantsSearch = /\b(find|show|search|homes|houses|condos|townhomes|properties|listings|affordable)\b/i
    .test(text);
  const wantsMarket = /\b(market|median|average|trend|trends|rising|falling|price per sq(?:uare)? foot|price per sqft|days on market|dom|sold comps|comps)\b/i
    .test(text);
  const wantsRecommend = Boolean(extractRecommendationListingId(text))
    || /\b(recommend(?:ations)?|similar|more like)\b/i.test(text);
  const wantsKnowledge = isKnowledgeQuestion(text);
  const wantsEmail = /\b(email|draft|send|compose)\b/i.test(text);

  if (wantsEmail) return "email-draft";
  if (wantsRecommend) return "recommend";
  if (wantsSearch && wantsMarket) return "mixed";
  if (wantsKnowledge) return "knowledge";
  if (wantsMarket) return "market";
  if (wantsSearch) return "search";
  return "fallback";
}

export function hasPendingPropertySearchFollowUp(userId: string): boolean {
  const session = getSession(userId);
  return session.conversationStep > 0 && Boolean(getFollowUpQuestion(session.filters));
}

async function defaultEmailDraftAgent(): Promise<AgentMessageResult> {
  return {
    message:
      "I can prepare an email draft once the email workflow is configured. No email was sent.",
  };
}

export const defaultAgents: OrchestratorAgents = {
  propertySearchAgent: async (query, userId) => handlePropertySearch(userId, query),
  marketStatsAgent: marketStatsSkill,
  recommendationAgent: recommendationSkill,
  ragAgent: ragSkill,
  emailDraftAgent: defaultEmailDraftAgent,
};

function getAgents(overrides: Partial<OrchestratorAgents> = {}): OrchestratorAgents {
  return {
    ...defaultAgents,
    ...overrides,
  };
}

export function formatCombinedResponse(parts: OrchestratorPart[]): string {
  if (parts.length === 0) return FALLBACK_MESSAGE;

  return parts
    .map((part) => `${part.title}:\n${part.message}`)
    .join("\n\n");
}

async function runMixedAgents(
  query: string,
  userId: string,
  agents: OrchestratorAgents,
): Promise<OrchestratorResult> {
  const [searchResult, marketResult] = await Promise.all([
    runAgentSafely(() => agents.propertySearchAgent(query, userId)),
    runAgentSafely(() => agents.marketStatsAgent(query)),
  ]);
  const parts: OrchestratorPart[] = [
    {
      intent: "search",
      title: "Property matches",
      message: searchResult.message,
    },
    {
      intent: "market",
      title: "Market summary",
      message: marketResult.message,
    },
  ];

  return {
    userId,
    intent: "mixed",
    message: formatCombinedResponse(parts),
    parts,
  };
}

async function runAgentSafely(
  runAgent: () => Promise<AgentMessageResult>,
): Promise<AgentMessageResult> {
  try {
    return await runAgent();
  } catch {
    return {
      message: ORCHESTRATION_ERROR_MESSAGE,
    };
  }
}

export async function orchestrate(
  query: string,
  userId: string,
  options: OrchestratorOptions = {},
): Promise<OrchestratorResult> {
  const normalizedQuery = normalize(query);
  const classifiedIntent = classifyIntent(normalizedQuery);
  const intent = classifiedIntent === "fallback" && hasPendingPropertySearchFollowUp(userId)
    ? "search"
    : classifiedIntent;
  const agents = getAgents(options.agents);

  if (intent === "mixed") {
    return runMixedAgents(normalizedQuery, userId, agents);
  }

  if (intent === "fallback") {
    return {
      userId,
      intent,
      message: FALLBACK_MESSAGE,
      parts: [],
    };
  }

  let result: AgentMessageResult;
  if (intent === "search") {
    result = await runAgentSafely(
      () => agents.propertySearchAgent(normalizedQuery, userId),
    );
  } else if (intent === "market") {
    result = await runAgentSafely(
      () => agents.marketStatsAgent(normalizedQuery),
    );
  } else if (intent === "recommend") {
    result = await runAgentSafely(
      () => agents.recommendationAgent(
        extractRecommendationListingId(normalizedQuery) ?? "",
      ),
    );
  } else if (intent === "knowledge") {
    result = await runAgentSafely(
      () => agents.ragAgent(normalizedQuery),
    );
  } else {
    result = await runAgentSafely(
      () => agents.emailDraftAgent(normalizedQuery, userId),
    );
  }

  return {
    userId,
    intent,
    message: result.message,
    parts: [
      {
        intent,
        title: intentTitle(intent),
        message: result.message,
      },
    ],
  };
}

function intentTitle(
  intent: Exclude<OrchestratorIntent, "mixed" | "fallback">,
): string {
  switch (intent) {
    case "search":
      return "Property search";
    case "market":
      return "Market summary";
    case "recommend":
      return "Recommendations";
    case "knowledge":
      return "Knowledge answer";
    case "email-draft":
      return "Email draft";
  }
}
