import { describe, expect, it } from "vitest";
import {
  buildActiveListingEmbeddingSourceQuery,
  buildCreateListingEmbeddingsTableQuery,
  buildSemanticCandidateQuery,
  rankSemanticCandidates,
  type SemanticCandidate,
} from "../src/db/semanticSearch";

function candidate(
  listingId: string,
  embedding: number[],
): SemanticCandidate {
  return {
    L_ListingID: listingId,
    L_DisplayId: listingId,
    L_Address: `${listingId} Test Street`,
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
    YearBuilt: 1998,
    AssociationFee: null,
    DaysOnMarket: 10,
    PoolPrivateYN: null,
    ViewYN: "1",
    FireplaceYN: null,
    PhotoCount: 20,
    LA1_UserFirstName: "Test",
    LA1_UserLastName: "Agent",
    LO1_OrganizationName: "Test Realty",
    embeddingModel: "test-model",
    textHash: "hash",
    embedding,
  };
}

describe("semantic search SQL builders", () => {
  it("creates the listing_embeddings table", () => {
    const sql = buildCreateListingEmbeddingsTableQuery();
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS listing_embeddings");
    expect(sql).toContain("PRIMARY KEY (listing_id, model)");
  });

  it("builds a parameterized active listing source query", () => {
    const result = buildActiveListingEmbeddingSourceQuery(999, -10);
    expect(result.params).toEqual(["Active", 500, 0]);
    expect(result.sql).toContain("FROM rets_property");
    expect(result.sql).toContain("L_Status = ?");
  });

  it("builds a parameterized candidate query", () => {
    const result = buildSemanticCandidateQuery("test-model", 3);
    expect(result.params).toEqual(["Active", "test-model", 3]);
    expect(result.sql).toContain("FROM listing_embeddings");
    expect(result.sql).toContain("JOIN rets_property");
  });
});

describe("rankSemanticCandidates", () => {
  it("sorts candidates by cosine similarity", () => {
    const results = rankSemanticCandidates(
      [1, 0, 0],
      [
        candidate("low", [0, 1, 0]),
        candidate("high", [1, 0, 0]),
        candidate("middle", [0.8, 0.2, 0]),
      ],
      2,
    );

    expect(results.map((result) => result.L_ListingID)).toEqual([
      "high",
      "middle",
    ]);
    expect(results[0].similarity).toBeCloseTo(1);
  });
});
