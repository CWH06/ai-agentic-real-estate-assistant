import type { ListingRow } from "../db/listingSearch";

export type PriceAssessment =
  | "below-comps"
  | "slightly-below-comps"
  | "near-comps"
  | "slightly-above-comps"
  | "above-comps"
  | "insufficient-comps";

export interface RecommendationScore {
  structuredScore: number;
  semanticScore: number;
  totalScore: number;
  semanticSimilarity: number;
}

export interface CompValidation {
  city: string | null;
  livingArea: number | null;
  listPrice: number | null;
  compCount: number;
  averagePricePerSqft: number | null;
  compPrice: number | null;
  deltaPct: number | null;
  assessment: PriceAssessment;
}

export interface RecommendedListing extends ListingRow {
  recommendation: RecommendationScore;
  compValidation: CompValidation;
  embeddingModel: string;
}
