import {
  getEmbeddingModel,
  parseEmbeddingJson,
  serializeEmbedding,
} from "../embeddings/openaiEmbeddings";
import type { RagChunkRecord } from "../types/rag";
import { query } from "./mysql";

interface ExistingRagChunkHashRow {
  chunk_index: number;
  text_hash: string;
}

interface RagChunkRow {
  documentId: string;
  documentTitle: string;
  sourceUrl: string | null;
  chunkIndex: number;
  content: string;
  textHash: string;
  model: string;
  embeddingJson: string;
}

export function buildCreateRagChunksTableQuery(): string {
  return `
    CREATE TABLE IF NOT EXISTS rag_chunks (
      document_id VARCHAR(255) NOT NULL,
      document_title VARCHAR(255) NOT NULL,
      source_url TEXT NULL,
      chunk_index INT NOT NULL,
      content TEXT NOT NULL,
      text_hash CHAR(64) NOT NULL,
      model VARCHAR(64) NOT NULL,
      embedding_json MEDIUMTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (document_id, chunk_index, model),
      KEY idx_rag_chunks_model (model),
      KEY idx_rag_chunks_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `.trim();
}

export async function ensureRagChunksTable(): Promise<void> {
  await query(buildCreateRagChunksTableQuery());
}

export async function getExistingRagChunkHashes(
  documentId: string,
  model = getEmbeddingModel(),
): Promise<Map<number, string>> {
  const rows = await query<ExistingRagChunkHashRow>(
    `
      SELECT chunk_index, text_hash
      FROM rag_chunks
      WHERE document_id = ?
        AND model = ?
    `.trim(),
    [documentId, model],
  );

  return new Map(rows.map((row) => [Number(row.chunk_index), row.text_hash]));
}

export async function upsertRagChunks(records: RagChunkRecord[]): Promise<void> {
  if (records.length === 0) return;

  const values = records.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  const params = records.flatMap((record) => [
    record.documentId,
    record.documentTitle,
    record.sourceUrl,
    record.chunkIndex,
    record.content,
    record.textHash,
    record.model,
    serializeEmbedding(record.embedding),
  ]);

  await query(
    `
      INSERT INTO rag_chunks (
        document_id,
        document_title,
        source_url,
        chunk_index,
        content,
        text_hash,
        model,
        embedding_json
      )
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        document_title = VALUES(document_title),
        source_url = VALUES(source_url),
        content = VALUES(content),
        text_hash = VALUES(text_hash),
        embedding_json = VALUES(embedding_json),
        updated_at = CURRENT_TIMESTAMP
    `.trim(),
    params,
  );
}

export async function deleteStaleRagChunks(
  documentId: string,
  model: string,
  firstStaleChunkIndex: number,
): Promise<void> {
  await query(
    `
      DELETE FROM rag_chunks
      WHERE document_id = ?
        AND model = ?
        AND chunk_index >= ?
    `.trim(),
    [documentId, model, Math.max(0, Math.floor(firstStaleChunkIndex))],
  );
}

export async function countRagChunks(
  model = getEmbeddingModel(),
): Promise<number> {
  await ensureRagChunksTable();
  const rows = await query<{ count: number | string }>(
    `
      SELECT COUNT(*) AS count
      FROM rag_chunks
      WHERE model = ?
    `.trim(),
    [model],
  );

  return Number(rows[0]?.count ?? 0);
}

export function buildRagCandidateQuery(
  model = getEmbeddingModel(),
  candidateLimit = 10_000,
): { sql: string; params: unknown[] } {
  const requestedLimit = Number.isFinite(candidateLimit)
    ? candidateLimit
    : 10_000;
  const safeLimit = Math.min(100_000, Math.max(1, Math.floor(requestedLimit)));

  return {
    sql: `
      SELECT
        document_id AS documentId,
        document_title AS documentTitle,
        source_url AS sourceUrl,
        chunk_index AS chunkIndex,
        content,
        text_hash AS textHash,
        model,
        embedding_json AS embeddingJson
      FROM rag_chunks
      WHERE model = ?
      ORDER BY document_id ASC, chunk_index ASC
      LIMIT ?
    `.trim(),
    params: [model, safeLimit],
  };
}

export async function getRagChunkCandidates(
  model = getEmbeddingModel(),
  candidateLimit = 10_000,
): Promise<RagChunkRecord[]> {
  await ensureRagChunksTable();
  const { sql, params } = buildRagCandidateQuery(model, candidateLimit);
  const rows = await query<RagChunkRow>(sql, params);

  return rows.flatMap((row) => {
    const embedding = parseEmbeddingJson(row.embeddingJson);
    if (!embedding) return [];

    return [{
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      sourceUrl: row.sourceUrl,
      chunkIndex: Number(row.chunkIndex),
      content: row.content,
      textHash: row.textHash,
      model: row.model,
      embedding,
    }];
  });
}
