import { describe, expect, it } from "vitest";
import type { ListingRow } from "../src/db/listingSearch";
import {
  assessPriceDelta,
  buildCompValidationQuery,
  buildRecommendationCandidatesQuery,
  buildRecommendationTargetQuery,
  calculateRecommendationScore,
  calculateStructuredSimilarity,
} from "../src/db/recommendations";

function listing(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    L_ListingID: "target",
    L_DisplayId: "target",
    L_Address: "12 Test Street",
    L_City: "Irvine",
    L_Zip: "92618",
    price: 1_000_000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    type: "SingleFamilyResidence",
    status: "Active",
    lat: null,
    lng: null,
    YearBuilt: 2000,
    AssociationFee: null,
    DaysOnMarket: 12,
    PoolPrivateYN: null,
    ViewYN: "1",
    FireplaceYN: null,
    PhotoCount: 20,
    LA1_UserFirstName: "Test",
    LA1_UserLastName: "Agent",
    LO1_OrganizationName: "Test Realty",
    ...overrides,
  };
}

describe("recommendation SQL builders", () => {
  it("builds a target lookup query", () => {
    const result = buildRecommendationTargetQuery();
    expect(result.sql).toContain("JOIN listing_embeddings");
    expect(result.sql).toContain("r.L_ListingID = ? OR r.L_DisplayId = ?");
  });

  it("builds a candidate query with safe limit", () => {
    const result = buildRecommendationCandidatesQuery("test-model", 500_000);
    expect(result.params).toEqual([
      "Active",
      "test-model",
      "",
      "",
      0,
      100_000,
    ]);
    expect(result.sql).toContain("r.L_ListingID <> ?");
  });

  it("builds a comp validation query", () => {
    const result = buildCompValidationQuery(500);
    expect(result.params).toEqual(["", 0, 0, 60]);
    expect(result.sql).toContain("FROM california_sold");
    expect(result.sql).toContain("LivingArea BETWEEN ? AND ?");
  });
});

describe("recommendation scoring", () => {
  it("scores structured similarity out of 60", () => {
    const score = calculateStructuredSimilarity(
      listing(),
      listing({
        L_ListingID: "candidate",
        price: 1_040_000,
        beds: 3,
        sqft: 2_000,
      }),
    );

    expect(score).toBe(60);
  });

  it("combines structured and semantic scores", () => {
    const score = calculateRecommendationScore(
      listing(),
      listing({
        L_ListingID: "candidate",
        price: 1_250_000,
        beds: 2,
        sqft: 2_400,
      }),
      [1, 0],
      [1, 0],
    );

    expect(score.structuredScore).toBe(25);
    expect(score.semanticScore).toBe(40);
    expect(score.totalScore).toBe(65);
    expect(score.semanticSimilarity).toBe(1);
  });

  it("assesses price deltas", () => {
    expect(assessPriceDelta(null)).toBe("insufficient-comps");
    expect(assessPriceDelta(-12)).toBe("below-comps");
    expect(assessPriceDelta(-6)).toBe("slightly-below-comps");
    expect(assessPriceDelta(0)).toBe("near-comps");
    expect(assessPriceDelta(7)).toBe("slightly-above-comps");
    expect(assessPriceDelta(12)).toBe("above-comps");
  });
});
