import {
  cosineSimilarity,
  getConfiguredEmbeddingProvider,
  getEmbeddingModel,
  type EmbeddingProvider,
  type EmbeddingVector,
} from "../embeddings/openaiEmbeddings";
import { getRagChunkCandidates } from "../db/rag";
import type { RagChunkRecord, RetrievedKnowledgeChunk } from "../types/rag";

export type RagCandidateProvider = (
  model: string,
  candidateLimit: number,
) => Promise<RagChunkRecord[]>;

export interface RetrieveKnowledgeOptions {
  topK?: number;
  model?: string;
  candidateLimit?: number;
  minSimilarity?: number;
  embeddingProvider?: EmbeddingProvider;
  candidateProvider?: RagCandidateProvider;
}

const QUERY_STOP_WORDS = new Set([
  "a", "an", "are", "does", "in", "is", "mean", "of", "the", "to", "what", "which",
]);

function retrievalTokens(text: string): string[] {
  return [...new Set(
    (text.toLowerCase().match(/[a-z0-9_]+/g) ?? [])
      .filter((token) => token.length >= 3 && !QUERY_STOP_WORDS.has(token)),
  )];
}

export function lexicalRetrievalBoost(
  question: string,
  candidate: RagChunkRecord,
): number {
  const tokens = retrievalTokens(question);
  if (tokens.length === 0) return 0;

  const candidateText = [
    candidate.documentId,
    candidate.documentTitle,
    candidate.content,
  ].join(" ").toLowerCase();
  const matchedTokens = tokens.filter((token) => candidateText.includes(token));
  const identifierBonus = tokens.some(
    (token) => token.includes("_") && candidateText.includes(token),
  ) ? 0.15 : 0;

  return (matchedTokens.length / tokens.length) * 0.2 + identifierBonus;
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function rankKnowledgeChunks(
  queryEmbedding: EmbeddingVector,
  candidates: RagChunkRecord[],
  topK = 4,
  minSimilarity = 0.15,
  question = "",
): RetrievedKnowledgeChunk[] {
  const safeTopK = Math.min(12, Math.max(1, Math.floor(topK)));

  return candidates
    .map((candidate) => {
      const similarity = cosineSimilarity(queryEmbedding, candidate.embedding);
      return {
        chunk: { ...candidate, similarity },
        retrievalScore: similarity + lexicalRetrievalBoost(question, candidate),
      };
    })
    .filter((candidate) => candidate.retrievalScore >= minSimilarity)
    .sort((first, second) => second.retrievalScore - first.retrievalScore)
    .slice(0, safeTopK)
    .map((candidate) => candidate.chunk);
}

export async function retrieveRelevantChunks(
  question: string,
  options: RetrieveKnowledgeOptions = {},
): Promise<RetrievedKnowledgeChunk[]> {
  const normalizedQuestion = question.replace(/\s+/g, " ").trim();
  if (!normalizedQuestion) return [];

  const model = getEmbeddingModel(options.model);
  const topK = options.topK
    ?? numberFromEnv("RAG_TOP_K", 4);
  const candidateLimit = options.candidateLimit
    ?? numberFromEnv("RAG_CANDIDATE_LIMIT", 10_000);
  const minSimilarity = options.minSimilarity
    ?? numberFromEnv("RAG_MIN_SIMILARITY", 0.15);
  const embeddingProvider = options.embeddingProvider
    ?? getConfiguredEmbeddingProvider();
  const candidateProvider = options.candidateProvider
    ?? getRagChunkCandidates;

  const [queryEmbedding] = await embeddingProvider(
    [normalizedQuestion],
    model,
    "query",
  );
  if (!queryEmbedding) {
    throw new Error("The embedding provider returned no query embedding.");
  }

  const candidates = await candidateProvider(model, candidateLimit);
  return rankKnowledgeChunks(
    queryEmbedding,
    candidates,
    topK,
    minSimilarity,
    normalizedQuestion,
  );
}
