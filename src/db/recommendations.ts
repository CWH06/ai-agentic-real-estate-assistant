import { cosineSimilarity, getEmbeddingModel, parseEmbeddingJson } from "../embeddings/openaiEmbeddings";
import type { EmbeddingVector } from "../embeddings/openaiEmbeddings";
import type { RecommendedListing, RecommendationScore, CompValidation, PriceAssessment } from "../types/recommendations";
import type { ListingRow } from "./listingSearch";
import { query } from "./mysql";
import { ensureListingEmbeddingsTable } from "./semanticSearch";

export interface RecommendationOptions {
  topK?: number;
  model?: string;
  candidateLimit?: number;
  compMonths?: number;
}

interface RecommendationListingRow extends ListingRow {
  embeddingModel: string;
  embeddingJson: string;
}

interface RecommendationCandidate extends ListingRow {
  embeddingModel: string;
  embedding: EmbeddingVector;
}

interface CompValidationRow {
  averagePricePerSqft: number | string | null;
  compCount: number | string;
}

export interface ListingRecommendationResult {
  target: ListingRow;
  recommendations: RecommendedListing[];
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTopK(topK = 5): number {
  return Math.min(20, Math.max(1, Math.floor(topK)));
}

function normalizeCandidateLimit(candidateLimit = 1_000): number {
  const requested = Number.isFinite(candidateLimit) ? candidateLimit : 1_000;
  return Math.min(100_000, Math.max(1, Math.floor(requested)));
}

function normalizeMonths(months = 6): number {
  const requested = Number.isFinite(months) ? months : 6;
  return Math.min(60, Math.max(1, Math.floor(requested)));
}

function rowToCandidate(row: RecommendationListingRow): RecommendationCandidate | null {
  const embedding = parseEmbeddingJson(row.embeddingJson);
  if (!embedding) return null;

  const { embeddingJson, ...listing } = row;
  return {
    ...listing,
    embedding,
  };
}

function sameText(first: string | null, second: string | null): boolean {
  if (!first || !second) return false;
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

function absoluteNumberDiff(
  first: number | null,
  second: number | null,
): number | null {
  if (first === null || second === null) return null;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return Math.abs(first - second);
}

export function calculateStructuredSimilarity(
  target: ListingRow,
  candidate: ListingRow,
): number {
  let score = 0;

  const priceDiff = absoluteNumberDiff(target.price, candidate.price);
  if (priceDiff !== null) {
    if (priceDiff < 50_000) score += 20;
    else if (priceDiff < 150_000) score += 12;
    else if (priceDiff < 300_000) score += 5;
  }

  if (
    target.beds !== null
    && candidate.beds !== null
    && Number(target.beds) === Number(candidate.beds)
  ) {
    score += 15;
  }

  if (sameText(target.L_City, candidate.L_City)) {
    score += 15;
  }

  const sqftDiff = absoluteNumberDiff(target.sqft, candidate.sqft);
  if (sqftDiff !== null) {
    if (sqftDiff < 300) score += 10;
    else if (sqftDiff < 700) score += 5;
  }

  return score;
}

export function calculateRecommendationScore(
  target: ListingRow,
  candidate: ListingRow,
  targetEmbedding: EmbeddingVector,
  candidateEmbedding: EmbeddingVector,
): RecommendationScore {
  const structuredScore = calculateStructuredSimilarity(target, candidate);
  const semanticSimilarity = cosineSimilarity(targetEmbedding, candidateEmbedding);
  const semanticScore = Math.max(0, semanticSimilarity) * 40;

  return {
    structuredScore: Math.round(structuredScore * 100) / 100,
    semanticScore: Math.round(semanticScore * 100) / 100,
    totalScore: Math.round((structuredScore + semanticScore) * 100) / 100,
    semanticSimilarity: Math.round(semanticSimilarity * 10_000) / 10_000,
  };
}

export function assessPriceDelta(deltaPct: number | null): PriceAssessment {
  if (deltaPct === null || !Number.isFinite(deltaPct)) {
    return "insufficient-comps";
  }
  if (deltaPct <= -10) return "below-comps";
  if (deltaPct <= -5) return "slightly-below-comps";
  if (deltaPct < 5) return "near-comps";
  if (deltaPct < 10) return "slightly-above-comps";
  return "above-comps";
}

export function buildRecommendationTargetQuery(): {
  sql: string;
  params: unknown[];
} {
  return {
    sql: `
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
        le.embedding_json AS embeddingJson
      FROM rets_property r
      JOIN listing_embeddings le
        ON le.listing_id = r.L_ListingID
      WHERE (r.L_ListingID = ? OR r.L_DisplayId = ?)
        AND r.L_Status = ?
        AND le.model = ?
      LIMIT 1
    `.trim(),
    params: [],
  };
}

export function buildRecommendationCandidatesQuery(
  model = getEmbeddingModel(),
  candidateLimit = 1_000,
): { sql: string; params: unknown[] } {
  const safeLimit = normalizeCandidateLimit(candidateLimit);

  return {
    sql: `
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
        le.embedding_json AS embeddingJson
      FROM listing_embeddings le
      JOIN rets_property r
        ON r.L_ListingID = le.listing_id
      WHERE r.L_Status = ?
        AND le.model = ?
        AND r.L_ListingID <> ?
      ORDER BY
        CASE WHEN r.L_City = ? THEN 0 ELSE 1 END,
        ABS(COALESCE(r.L_SystemPrice, 0) - ?) ASC
      LIMIT ?
    `.trim(),
    params: ["Active", model, "", "", 0, safeLimit],
  };
}

export function buildCompValidationQuery(
  months = 6,
): { sql: string; params: unknown[] } {
  const safeMonths = normalizeMonths(months);

  return {
    sql: `
      SELECT
        AVG(ClosePrice / NULLIF(LivingArea, 0)) AS averagePricePerSqft,
        COUNT(*) AS compCount
      FROM california_sold
      WHERE LOWER(TRIM(City)) = LOWER(TRIM(?))
        AND PropertyType = "Residential"
        AND ClosePrice > 0
        AND LivingArea BETWEEN ? AND ?
        AND STR_TO_DATE(CloseDate, "%Y-%m-%d")
          >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
    `.trim(),
    params: ["", 0, 0, safeMonths],
  };
}

export async function getRecommendationTarget(
  listingId: string,
  model = getEmbeddingModel(),
): Promise<RecommendationCandidate | null> {
  await ensureListingEmbeddingsTable();
  const { sql } = buildRecommendationTargetQuery();
  const rows = await query<RecommendationListingRow>(
    sql,
    [listingId, listingId, "Active", model],
  );

  return rows[0] ? rowToCandidate(rows[0]) : null;
}

export async function getRecommendationCandidates(
  target: ListingRow,
  model = getEmbeddingModel(),
  candidateLimit = 1_000,
): Promise<RecommendationCandidate[]> {
  const { sql, params } = buildRecommendationCandidatesQuery(
    model,
    candidateLimit,
  );

  const rows = await query<RecommendationListingRow>(
    sql,
    [
      params[0],
      params[1],
      target.L_ListingID ?? "",
      target.L_City ?? "",
      target.price ?? 0,
      params[5],
    ],
  );

  return rows
    .map(rowToCandidate)
    .filter((candidate): candidate is RecommendationCandidate => Boolean(candidate));
}

export async function validateWithComps(
  listing: ListingRow,
  months = 6,
): Promise<CompValidation> {
  const city = listing.L_City;
  const livingArea = listing.sqft;
  const listPrice = listing.price;

  if (!city || !livingArea || !listPrice) {
    return {
      city,
      livingArea,
      listPrice,
      compCount: 0,
      averagePricePerSqft: null,
      compPrice: null,
      deltaPct: null,
      assessment: "insufficient-comps",
    };
  }

  const minSqft = Math.round(livingArea * 0.8);
  const maxSqft = Math.round(livingArea * 1.2);
  const { sql, params } = buildCompValidationQuery(months);
  const rows = await query<CompValidationRow>(
    sql,
    [city, minSqft, maxSqft, params[3]],
  );

  const averagePricePerSqft = toNullableNumber(rows[0]?.averagePricePerSqft);
  const compCount = Number(rows[0]?.compCount ?? 0);

  if (!averagePricePerSqft || compCount === 0) {
    return {
      city,
      livingArea,
      listPrice,
      compCount,
      averagePricePerSqft,
      compPrice: null,
      deltaPct: null,
      assessment: "insufficient-comps",
    };
  }

  const compPrice = Math.round(averagePricePerSqft * livingArea);
  const deltaPct = Math.round(((listPrice - compPrice) / compPrice) * 1_000) / 10;

  return {
    city,
    livingArea,
    listPrice,
    compCount,
    averagePricePerSqft: Math.round(averagePricePerSqft * 100) / 100,
    compPrice,
    deltaPct,
    assessment: assessPriceDelta(deltaPct),
  };
}

export async function getListingRecommendations(
  listingId: string,
  options: RecommendationOptions = {},
): Promise<ListingRecommendationResult | null> {
  const normalizedListingId = listingId.trim();
  if (!normalizedListingId) return null;

  const model = getEmbeddingModel(options.model);
  const target = await getRecommendationTarget(normalizedListingId, model);
  if (!target) return null;

  const envCandidateLimit = Number(process.env.RECOMMENDATION_CANDIDATE_LIMIT);
  const candidateLimit = options.candidateLimit
    ?? (Number.isFinite(envCandidateLimit) ? envCandidateLimit : 1_000);
  const envCompMonths = Number(process.env.RECOMMENDATION_COMP_MONTHS);
  const compMonths = options.compMonths
    ?? (Number.isFinite(envCompMonths) ? envCompMonths : 6);

  const candidates = await getRecommendationCandidates(
    target,
    model,
    candidateLimit,
  );

  const targetEmbedding = target.embedding;
  const scoredCandidates = candidates
    .map((candidate) => ({
      candidate,
      recommendation: calculateRecommendationScore(
        target,
        candidate,
        targetEmbedding,
        candidate.embedding,
      ),
    }))
    .sort((first, second) => second.recommendation.totalScore - first.recommendation.totalScore)
    .slice(0, normalizeTopK(options.topK));

  const recommendations = await Promise.all(
    scoredCandidates.map(async ({ candidate, recommendation }) => {
      const { embedding, ...listing } = candidate;
      return {
        ...listing,
        recommendation,
        compValidation: await validateWithComps(listing, compMonths),
      };
    }),
  );

  const { embedding, ...targetListing } = target;

  return {
    target: targetListing,
    recommendations,
  };
}
