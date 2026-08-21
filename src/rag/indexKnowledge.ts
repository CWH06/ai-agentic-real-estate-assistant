import {
  getConfiguredEmbeddingProvider,
  getEmbeddingModel,
  getEmbeddingProviderName,
  type EmbeddingProvider,
} from "../embeddings/openaiEmbeddings";
import {
  deleteStaleRagChunks,
  ensureRagChunksTable,
  getExistingRagChunkHashes,
  upsertRagChunks,
} from "../db/rag";
import type { KnowledgeChunk, KnowledgeDocument, RagChunkRecord } from "../types/rag";
import { chunkKnowledgeDocument, type ChunkTextOptions } from "./chunkText";
import { loadKnowledgeDocuments } from "./loadKnowledgeDocuments";

export interface KnowledgeIndexStats {
  documents: number;
  chunks: number;
  indexed: number;
  skipped: number;
  provider: string;
  model: string;
}
export interface IndexKnowledgeOptions extends ChunkTextOptions {
  directory?: string;
  model?: string;
  batchSize?: number;
  embeddingProvider?: EmbeddingProvider;
  documents?: KnowledgeDocument[];
}

function safeBatchSize(value: number | undefined): number {
  const envValue = Number(process.env.RAG_EMBEDDINGS_BATCH_SIZE);
  const requested = value ?? (Number.isFinite(envValue) ? envValue : 50);
  return Math.min(100, Math.max(1, Math.floor(requested)));
}

function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function embeddingText(chunk: KnowledgeChunk): string {
  return `${chunk.documentTitle}\n${chunk.content}`;
}

export async function indexKnowledgeBase(
  options: IndexKnowledgeOptions = {},
): Promise<KnowledgeIndexStats> {
  const model = getEmbeddingModel(options.model);
  const providerName = options.embeddingProvider
    ? "custom"
    : getEmbeddingProviderName();
  const embeddingProvider = options.embeddingProvider
    ?? getConfiguredEmbeddingProvider();
  const documents = options.documents
    ?? await loadKnowledgeDocuments(options.directory);
  const batchSize = safeBatchSize(options.batchSize);

  await ensureRagChunksTable();

  let totalChunks = 0;
  let indexed = 0;
  let skipped = 0;

  for (const document of documents) {
    const chunks = chunkKnowledgeDocument(document, {
      chunkSize: options.chunkSize,
      overlap: options.overlap,
    });
    totalChunks += chunks.length;

    const existingHashes = await getExistingRagChunkHashes(document.id, model);
    const changedChunks = chunks.filter(
      (chunk) => existingHashes.get(chunk.chunkIndex) !== chunk.textHash,
    );
    skipped += chunks.length - changedChunks.length;

    for (const batch of batches(changedChunks, batchSize)) {
      const embeddings = await embeddingProvider(
        batch.map(embeddingText),
        model,
        "document",
      );
      if (embeddings.length !== batch.length) {
        throw new Error("Embedding response count did not match RAG chunk count.");
      }

      const records: RagChunkRecord[] = batch.map((chunk, index) => {
        const embedding = embeddings[index];
        if (!embedding) {
          throw new Error(`Missing embedding for ${chunk.documentId} chunk ${chunk.chunkIndex}.`);
        }
        return { ...chunk, model, embedding };
      });

      await upsertRagChunks(records);
      indexed += records.length;
    }

    await deleteStaleRagChunks(document.id, model, chunks.length);
  }

  return {
    documents: documents.length,
    chunks: totalChunks,
    indexed,
    skipped,
    provider: providerName,
    model,
  };
}
