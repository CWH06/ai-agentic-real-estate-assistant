import { countRagChunks } from "../../db/rag";
import {
  generateGroundedAnswer,
  INSUFFICIENT_CONTEXT_MESSAGE,
  type GroundedAnswerProvider,
  type LlmProviderName,
} from "../../rag/generateGroundedAnswer";
import {
  retrieveRelevantChunks,
  type RetrieveKnowledgeOptions,
} from "../../rag/retrieveChunks";
import type {
  RagSkillResult,
  RagSource,
  RetrievedKnowledgeChunk,
} from "../../types/rag";

export interface RagSkillOptions extends RetrieveKnowledgeOptions {
  chatModel?: string;
  llmProvider?: LlmProviderName;
  retriever?: typeof retrieveRelevantChunks;
  answerProvider?: GroundedAnswerProvider;
  indexedChunkCounter?: (model?: string) => Promise<number>;
}

export function sourcesFromChunks(
  chunks: RetrievedKnowledgeChunk[],
): RagSource[] {
  const sources = new Map<string, RagSource>();

  for (const chunk of chunks) {
    const existing = sources.get(chunk.documentId);
    if (!existing || chunk.similarity > existing.similarity) {
      sources.set(chunk.documentId, {
        documentId: chunk.documentId,
        title: chunk.documentTitle,
        sourceUrl: chunk.sourceUrl,
        similarity: chunk.similarity,
      });
    }
  }

  return [...sources.values()].sort(
    (first, second) => second.similarity - first.similarity,
  );
}

export function formatRagSources(sources: RagSource[]): string {
  if (sources.length === 0) return "";

  const lines = sources.map((source) => source.sourceUrl
    ? `- ${source.title}: ${source.sourceUrl}`
    : `- ${source.title}`);
  return `Sources:\n${lines.join("\n")}`;
}

/** Week 8 retrieval-augmented knowledge question answering skill. */
export async function ragSkill(
  question: string,
  options: RagSkillOptions = {},
): Promise<RagSkillResult> {
  const normalizedQuestion = question.replace(/\s+/g, " ").trim();
  if (!normalizedQuestion) {
    return {
      status: "needs-question",
      message: "What real estate term or project field would you like explained?",
      question: normalizedQuestion,
      sources: [],
    };
  }

  const retriever = options.retriever ?? retrieveRelevantChunks;
  const answerProvider = options.answerProvider ?? generateGroundedAnswer;
  const indexedChunkCounter = options.indexedChunkCounter ?? countRagChunks;

  try {
    const chunks = await retriever(normalizedQuestion, {
      topK: options.topK ?? 4,
      model: options.model,
      candidateLimit: options.candidateLimit,
      minSimilarity: options.minSimilarity,
      embeddingProvider: options.embeddingProvider,
      candidateProvider: options.candidateProvider,
    });

    if (chunks.length === 0) {
      const indexedCount = await indexedChunkCounter(options.model);
      return {
        status: indexedCount === 0 ? "not-indexed" : "insufficient-context",
        message: indexedCount === 0
          ? "The knowledge base is not indexed yet. Run npm run rag:index first."
          : INSUFFICIENT_CONTEXT_MESSAGE,
        question: normalizedQuestion,
        sources: [],
      };
    }

    const sources = sourcesFromChunks(chunks);
    const answerOptions = options.llmProvider
      ? { model: options.chatModel, provider: options.llmProvider }
      : { model: options.chatModel };
    const answer = await answerProvider(
      normalizedQuestion,
      chunks,
      answerOptions,
    );
    const sourceList = formatRagSources(sources);
    const hasInsufficientContext = answer.toLowerCase().includes(
      INSUFFICIENT_CONTEXT_MESSAGE.toLowerCase(),
    );

    return {
      status: hasInsufficientContext
        ? "insufficient-context"
        : "success",
      message: sourceList ? `${answer}\n\n${sourceList}` : answer,
      question: normalizedQuestion,
      sources,
    };
  } catch {
    return {
      status: "error",
      message: "I couldn't search the project knowledge base right now. Please try again.",
      question: normalizedQuestion,
      sources: [],
    };
  }
}

export {
  countRagChunks,
  generateGroundedAnswer,
  retrieveRelevantChunks,
};
