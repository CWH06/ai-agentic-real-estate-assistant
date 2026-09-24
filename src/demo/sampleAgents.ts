import path from "node:path";
import type { ListingRow } from "../db/listingSearch";
import { calculateRecommendationScore } from "../db/recommendations";
import { rankSemanticCandidates } from "../db/semanticSearch";
import { EmailWorkflow } from "../email/emailAgent";
import type { EmailMessage } from "../email/types";
import type { OrchestratorAgents } from "../orchestrator";
import { chunkKnowledgeDocument } from "../rag/chunkText";
import { loadKnowledgeDocuments } from "../rag/loadKnowledgeDocuments";
import { lexicalRetrievalBoost } from "../rag/retrieveChunks";
import { formatMarketStats, parseMarketQuery, type MarketStatsSkillResult } from "../skills/market-stats";
import { handlePropertySearch } from "../skills/property-search/conversation";
import { ragSkill } from "../skills/rag";
import { formatRecommendationCards, formatRecommendationMessage } from "../skills/recommendations";
import { formatSemanticResults, formatSemanticSearchMessage } from "../skills/semantic-search";
import type { MarketStatsReport } from "../types/marketStats";
import type { PropertyFilters } from "../types/propertyFilters";

// Invented records, not MLS exports. Feature vectors are deliberately NOT LLM embeddings.
function listing(id: number, city: string, price: number, pool: boolean, view: boolean): ListingRow {
  return {
    L_ListingID: String(id), L_DisplayId: `DEMO-${id}`,
    L_Address: `${id - 900000} Sample Lane (fictional)`, L_City: city, L_Zip: null,
    price, beds: 3, baths: 2, sqft: 1800, type: "SingleFamilyResidence", status: "Active",
    lat: null, lng: null, YearBuilt: 2000, AssociationFee: 100, DaysOnMarket: 21,
    PoolPrivateYN: pool ? "True" : "False", ViewYN: view ? "True" : "False",
    FireplaceYN: "False", PhotoCount: 0, LA1_UserFirstName: null,
    LA1_UserLastName: null, LO1_OrganizationName: null,
  };
}

export const SAMPLE_LISTINGS = [
  listing(900001, "Irvine", 1200000, true, true),
  listing(900002, "Irvine", 1240000, true, false),
  listing(900003, "Irvine", 1400000, false, true),
  listing(900004, "Pasadena", 950000, false, true),
  listing(900005, "Pasadena", 990000, true, true),
];

function featureVector(row: ListingRow): number[] {
  return [1, row.PoolPrivateYN === "True" ? 1 : 0, row.ViewYN === "True" ? 1 : 0];
}

export async function searchSampleListings(filters: PropertyFilters, page = 1, limit = 5): Promise<ListingRow[]> {
  const matches = SAMPLE_LISTINGS.filter((row) =>
    (!filters.city || row.L_City?.toLowerCase() === filters.city.toLowerCase())
    && (!filters.maxPrice || (row.price ?? Infinity) <= filters.maxPrice)
    && (!filters.beds || (row.beds ?? 0) >= filters.beds)
    && (!filters.baths || (row.baths ?? 0) >= filters.baths)
    && (!filters.sqft || (row.sqft ?? 0) >= filters.sqft)
    && (!filters.type || row.type === filters.type)
    && (!filters.pool || row.PoolPrivateYN === filters.pool)
    && (!filters.hasView || row.ViewYN === filters.hasView)
    && (!filters.maxHoa || (row.AssociationFee ?? Infinity) <= filters.maxHoa),
  ).sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  return matches.slice((page - 1) * limit, page * limit);
}

// A fixed, synthetic monthly snapshot, ending August 2026. Never real market advice.
export async function sampleMarketReport(query: string): Promise<MarketStatsSkillResult> {
  const filters = parseMarketQuery(query);
  if (!filters.city) return { status: "needs-city", filters, report: null, message: "Which city: Irvine or Pasadena?" };
  const base = filters.city === "Irvine" ? 1200000 : filters.city === "Pasadena" ? 950000 : null;
  if (!base) return { status: "error", filters, report: null, message: "Sample data only covers Irvine and Pasadena. Use live mode for other cities." };
  const monthlyTrend = Array.from({ length: filters.months }, (_, index) => ({
    month: new Date(Date.UTC(2026, 8 - filters.months + index, 1)).toISOString().slice(0, 7),
    soldCount: 2, averageClosePrice: base + index * 1000,
    averagePricePerSqft: (base + index * 1000) / 1800, averageDaysOnMarket: 21,
  }));
  const average = base + (filters.months - 1) * 500;
  const report: MarketStatsReport = {
    summary: {
      city: filters.city, months: filters.months, soldCount: filters.months * 2,
      averageClosePrice: average, medianClosePrice: average,
      averagePricePerSqft: average / 1800, averageDaysOnMarket: 21, listToClosePercent: 99,
    }, monthlyTrend,
  };
  return { status: "success", filters, report, message: `[SAMPLE DATA — snapshot ending 2026-08]\n${formatMarketStats(report)}` };
}

export async function createSampleAgents(): Promise<{
  agents: OrchestratorAgents;
  simulatedDeliveries: EmailMessage[];
}> {
  // Explicit path prevents a local RAG_KNOWLEDGE_DIR from changing the reproducible demo.
  const documents = await loadKnowledgeDocuments(path.resolve(process.cwd(), "knowledge"));
  const chunks = documents.flatMap((document) => chunkKnowledgeDocument(document))
    .map((chunk) => ({ ...chunk, model: "sample-lexical", embedding: [0] }));
  const simulatedDeliveries: EmailMessage[] = [];
  const email = new EmailWorkflow({
    marketReportProvider: sampleMarketReport,
    emailSender: async (message) => { simulatedDeliveries.push(message); },
  });
  const agents: OrchestratorAgents = {
    propertySearchAgent: async (query, userId) => handlePropertySearch(userId, query, searchSampleListings),
    marketStatsAgent: sampleMarketReport,
    semanticSearchAgent: async (query) => {
      const vector = [1, /pool/i.test(query) ? 1 : 0, /view|mountain/i.test(query) ? 1 : 0];
      const matches = rankSemanticCandidates(vector, SAMPLE_LISTINGS.map((row) => ({
        ...row, embedding: featureVector(row), embeddingModel: "sample-features", textHash: "sample",
      })), 3);
      return { message: `[SAMPLE — feature vectors, not model embeddings]\n${formatSemanticSearchMessage(formatSemanticResults(matches))}` };
    },
    recommendationAgent: async (id) => {
      const target = SAMPLE_LISTINGS.find((row) => row.L_ListingID === id);
      if (!target) return { message: "Choose a sample listing ID, such as 900001." };
      const recommendations = SAMPLE_LISTINGS.filter((row) => row !== target).map((row) => ({
        ...row, embeddingModel: "sample-features",
        recommendation: calculateRecommendationScore(target, row, featureVector(target), featureVector(row)),
        compValidation: {
          city: row.L_City, livingArea: row.sqft, listPrice: row.price, compCount: 0,
          averagePricePerSqft: null, compPrice: null, deltaPct: null,
          assessment: "insufficient-comps" as const,
        },
      })).sort((a, b) => b.recommendation.totalScore - a.recommendation.totalScore).slice(0, 3);
      const cards = formatRecommendationCards({ target, recommendations });
      return { message: `[SAMPLE — no sold-comparable validation]\n${formatRecommendationMessage(cards.recommendations)}` };
    },
    ragAgent: async (question) => ragSkill(question, {
      retriever: async (text) => chunks.map((chunk) => ({
        ...chunk, similarity: lexicalRetrievalBoost(text, chunk),
      })).filter((chunk) => chunk.similarity > 0).sort((a, b) => b.similarity - a.similarity).slice(0, 1),
      indexedChunkCounter: async () => chunks.length,
      answerProvider: async (_text, context) => `[SAMPLE — verbatim document excerpt; no LLM call]\n${context[0].content}`,
    }),
    emailDraftAgent: async (query, userId) => {
      const result = await email.handle(query, userId);
      return { message: result.status === "sent"
        ? "[SAMPLE] Approval recorded. Simulated delivery only; no email was sent."
        : `[SAMPLE — email delivery is simulated]\n${result.message}` };
    },
  };
  return { agents, simulatedDeliveries };
}

export const DEMO_QUERIES = [
  "help",
  "Find properties in Irvine",
  "under $2m",
  "houses",
  "3",
  "Market stats for Irvine over 6 months",
  "Semantic search: a home with a pool and mountain views",
  "Similar to 900001",
  "What does DOM mean?",
  "Find 3 bedroom houses in Pasadena under $2m and show market trends",
  "Draft a weekly market report for Irvine over 6 months to demo@example.com",
  "CONFIRM EMAIL",
  "CONFIRM EMAIL",
  "Can you book me a flight?",
];
