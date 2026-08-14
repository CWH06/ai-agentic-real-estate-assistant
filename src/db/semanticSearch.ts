import {
  cosineSimilarity,
  getConfiguredEmbeddingProvider,
  getEmbeddingModel,
  parseEmbeddingJson,
  serializeEmbedding,
  type EmbeddingProvider,
  type EmbeddingVector,
} from "../embeddings/openaiEmbeddings";
import type { ListingEmbeddingTextRow } from "../embeddings/listingText";
import type { ListingRow } from "./listingSearch";
import { query } from "./mysql";

export interface ListingEmbeddingRecord {
  listingId: string;
  model: string;
  textHash: string;
  embedding: EmbeddingVector;
}

export interface ExistingEmbeddingHashRow {
  listing_id: string;
  text_hash: string;
}

export interface SemanticSearchOptions {
  topK?: number;
  model?: string;
  candidateLimit?: number;
  embeddingProvider?: EmbeddingProvider;
  minSimilarity?: number;
}

export interface SemanticCandidate extends ListingRow {
  embeddingModel: string;
  textHash: string;
  embedding: EmbeddingVector;
}

export interface SemanticListingMatch extends ListingRow {
  similarity: number;
  embeddingModel: string;
}

interface SemanticCandidateRow extends ListingRow {
  embeddingModel: string;
  textHash: string;
  embeddingJson: string;
}

export function buildCreateListingEmbeddingsTableQuery(): string {
  return `
    CREATE TABLE IF NOT EXISTS listing_embeddings (
      listing_id VARCHAR(255) NOT NULL,
      model VARCHAR(64) NOT NULL,
      text_hash CHAR(64) NOT NULL,
      embedding_json MEDIUMTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (listing_id, model),
      KEY idx_listing_embeddings_model (model),
      KEY idx_listing_embeddings_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `.trim();
}

export async function ensureListingEmbeddingsTable(): Promise<void> {
  await query(buildCreateListingEmbeddingsTableQuery());
}

export function buildActiveListingEmbeddingSourceQuery(
  limit = 100,
  offset = 0,
): { sql: string; params: unknown[] } {
  const safeLimit = Math.min(500, Math.max(1, Math.floor(limit)));
  const safeOffset = Math.max(0, Math.floor(offset));

  const sql = `
    SELECT
      L_ListingID,
      L_DisplayId,
      L_Address,
      L_City,
      L_Zip,
      L_Type_,
      L_Keyword2,
      LM_Dec_3,
      LM_Int2_3,
      L_SystemPrice,
      YearBuilt,
      L_Remarks,
      SubdivisionName,
      ArchitecturalStyle,
      View,
      PoolPrivateYN,
      ViewYN,
      FireplaceYN
    FROM rets_property
    WHERE L_Status = ?
      AND L_ListingID IS NOT NULL
      AND L_Remarks IS NOT NULL
      AND TRIM(L_Remarks) <> ""
    ORDER BY id ASC
    LIMIT ? OFFSET ?
  `.trim();

  return {
    sql,
    params: ["Active", safeLimit, safeOffset],
  };
}

export async function getActiveListingEmbeddingSources(
  limit = 100,
  offset = 0,
): Promise<ListingEmbeddingTextRow[]> {
  const { sql, params } = buildActiveListingEmbeddingSourceQuery(limit, offset);
  return query<ListingEmbeddingTextRow>(sql, params);
}

export async function getExistingEmbeddingHashes(
  listingIds: string[],
  model = getEmbeddingModel(),
): Promise<Map<string, string>> {
  if (listingIds.length === 0) return new Map();

  const placeholders = listingIds.map(() => "?").join(", ");
  const rows = await query<ExistingEmbeddingHashRow>(
    `
      SELECT listing_id, text_hash
      FROM listing_embeddings
      WHERE model = ?
        AND listing_id IN (${placeholders})
    `.trim(),
    [model, ...listingIds],
  );

  return new Map(rows.map((row) => [row.listing_id, row.text_hash]));
}

export async function upsertListingEmbeddings(
  records: ListingEmbeddingRecord[],
): Promise<void> {
  if (records.length === 0) return;

  const values = records.map(() => "(?, ?, ?, ?)").join(", ");
  const params = records.flatMap((record) => [
    record.listingId,
    record.model,
    record.textHash,
    serializeEmbedding(record.embedding),
  ]);

  await query(
    `
      INSERT INTO listing_embeddings (
        listing_id,
        model,
        text_hash,
        embedding_json
      )
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        text_hash = VALUES(text_hash),
        embedding_json = VALUES(embedding_json),
        updated_at = CURRENT_TIMESTAMP
    `.trim(),
    params,
  );
}

export async function countListingEmbeddings(
  model = getEmbeddingModel(),
): Promise<number> {
  await ensureListingEmbeddingsTable();
  const rows = await query<{ count: number | string }>(
    `
      SELECT COUNT(*) AS count
      FROM listing_embeddings
      WHERE model = ?
    `.trim(),
    [model],
  );

  return Number(rows[0]?.count ?? 0);
}

export function buildSemanticCandidateQuery(
  model = getEmbeddingModel(),
  candidateLimit = 10_000,
): { sql: string; params: unknown[] } {
  const requestedLimit = Number.isFinite(candidateLimit)
    ? candidateLimit
    : 10_000;
  const safeLimit = Math.min(100_000, Math.max(1, Math.floor(requestedLimit)));

  const sql = `
    SELECT
      r.L_ListingID,
      r.L_DisplayId,
      r.L_Address,
      r.L_City,
      r.L_Zip,
      r.L_SystemPrice AS price,
      r.L_Keyword2 AS beds,
      r.LM_Dec_3 AS baths,
      r.LM_Int2_3 AS sqft,
      r.L_Type_ AS type,
      r.L_Status AS status,
      r.LMD_MP_Latitude AS lat,
      r.LMD_MP_Longitude AS lng,
      r.YearBuilt,
      r.AssociationFee,
      r.DaysOnMarket,
      r.PoolPrivateYN,
      r.ViewYN,
      r.FireplaceYN,
      r.PhotoCount,
      r.LA1_UserFirstName,
      r.LA1_UserLastName,
      r.LO1_OrganizationName,
      le.model AS embeddingModel,
      le.text_hash AS textHash,
      le.embedding_json AS embeddingJson
    FROM listing_embeddings le
    JOIN rets_property r
      ON r.L_ListingID = le.listing_id
    WHERE r.L_Status = ?
      AND le.model = ?
    ORDER BY r.id ASC
    LIMIT ?
  `.trim();

  return {
    sql,
    params: ["Active", model, safeLimit],
  };
}

function rowToCandidate(row: SemanticCandidateRow): SemanticCandidate | null {
  const embedding = parseEmbeddingJson(row.embeddingJson);
  if (!embedding) return null;
  const { embeddingJson, ...listing } = row;

  return {
    ...listing,
    embedding,
  };
}

export function rankSemanticCandidates(
  queryEmbedding: EmbeddingVector,
  candidates: SemanticCandidate[],
  topK = 5,
  minSimilarity = Number.NEGATIVE_INFINITY,
): SemanticListingMatch[] {
  const safeTopK = Math.min(20, Math.max(1, Math.floor(topK)));

  return candidates
    .map((candidate) => ({
      ...candidate,
      similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
    }))
    .filter((candidate) => Number.isFinite(candidate.similarity))
    .filter((candidate) => candidate.similarity >= minSimilarity)
    .sort((first, second) => second.similarity - first.similarity)
    .slice(0, safeTopK)
    .map(({ embedding, textHash, ...match }) => match);
}

export async function searchSemanticListings(
  searchText: string,
  options: SemanticSearchOptions = {},
): Promise<SemanticListingMatch[]> {
  const normalizedSearchText = searchText.trim();
  if (!normalizedSearchText) return [];

  await ensureListingEmbeddingsTable();

  const model = getEmbeddingModel(options.model);
  const embeddingProvider = options.embeddingProvider ?? getConfiguredEmbeddingProvider();
  const [queryEmbedding] = await embeddingProvider(
    [normalizedSearchText],
    model,
    "query",
  );

  const envCandidateLimit = Number(process.env.SEMANTIC_CANDIDATE_LIMIT);
  const candidateLimit = options.candidateLimit
    ?? (Number.isFinite(envCandidateLimit) ? envCandidateLimit : 10_000);
  const { sql, params } = buildSemanticCandidateQuery(
    model,
    candidateLimit,
  );
  const rows = await query<SemanticCandidateRow>(sql, params);
  const candidates = rows
    .map(rowToCandidate)
    .filter((candidate): candidate is SemanticCandidate => Boolean(candidate));

  return rankSemanticCandidates(
    queryEmbedding,
    candidates,
    options.topK,
    options.minSimilarity,
  );
}
