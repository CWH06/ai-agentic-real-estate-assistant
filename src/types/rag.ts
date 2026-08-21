import type { EmbeddingVector } from "../embeddings/openaiEmbeddings";

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  sourcePath: string;
  sourceUrl: string | null;
}
export interface KnowledgeChunk {
  documentId: string;
  documentTitle: string;
  sourceUrl: string | null;
  chunkIndex: number;
  content: string;
  textHash: string;
}

export interface RagChunkRecord extends KnowledgeChunk {
  model: string;
  embedding: EmbeddingVector;
}

export interface RetrievedKnowledgeChunk extends RagChunkRecord {
  similarity: number;
}

export interface RagSource {
  documentId: string;
  title: string;
  sourceUrl: string | null;
  similarity: number;
}

export type RagSkillStatus =
  | "success"
  | "needs-question"
  | "not-indexed"
  | "insufficient-context"
  | "error";

export interface RagSkillResult {
  status: RagSkillStatus;
  message: string;
  question: string;
  sources: RagSource[];
}
