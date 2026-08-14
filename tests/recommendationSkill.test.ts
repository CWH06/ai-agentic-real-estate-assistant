import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingRecommendationResult } from "../src/db/recommendations";

const {
  countListingEmbeddingsMock,
  getListingRecommendationsMock,
} = vi.hoisted(() => ({
  countListingEmbeddingsMock: vi.fn(),
  getListingRecommendationsMock: vi.fn(),
}));

vi.mock("../src/db/semanticSearch", () => ({
  countListingEmbeddings: countListingEmbeddingsMock,
}));

vi.mock("../src/db/recommendations", () => ({
  getListingRecommendations: getListingRecommendationsMock,
}));

import { recommendationSkill } from "../src/skills/recommendations";

const result: ListingRecommendationResult = {
  target: {
    L_ListingID: "target",
    L_DisplayId: "target",
    L_Address: "12 Target Street",
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
  },
  recommendations: [
    {
      L_ListingID: "candidate",
      L_DisplayId: "candidate",
      L_Address: "14 Candidate Street",
      L_City: "Irvine",
      L_Zip: "92618",
      price: 1_040_000,
      beds: 3,
      baths: 2,
      sqft: 1850,
      type: "SingleFamilyResidence",
      status: "Active",
      lat: null,
      lng: null,
      YearBuilt: 2002,
      AssociationFee: null,
      DaysOnMarket: 10,
      PoolPrivateYN: null,
      ViewYN: "1",
      FireplaceYN: null,
      PhotoCount: 22,
      LA1_UserFirstName: "Demo",
      LA1_UserLastName: "Agent",
      LO1_OrganizationName: "Demo Realty",
      embeddingModel: "test-model",
      recommendation: {
        structuredScore: 60,
        semanticScore: 38,
        totalScore: 98,
        semanticSimilarity: 0.95,
      },
      compValidation: {
        city: "Irvine",
        livingArea: 1850,
        listPrice: 1_040_000,
        compCount: 12,
        averagePricePerSqft: 550,
        compPrice: 1_017_500,
        deltaPct: 2.2,
        assessment: "near-comps",
      },
    },
  ],
};

describe("recommendationSkill", () => {
  beforeEach(() => {
    countListingEmbeddingsMock.mockReset();
    getListingRecommendationsMock.mockReset();
  });

  it("asks for a listing id", async () => {
    await expect(recommendationSkill("   ")).resolves.toMatchObject({
      status: "needs-listing",
      target: null,
      recommendations: [],
    });
  });

  it("explains when embeddings are missing", async () => {
    countListingEmbeddingsMock.mockResolvedValueOnce(0);

    const response = await recommendationSkill("target");

    expect(response.status).toBe("not-indexed");
    expect(response.message).toContain("npm run embeddings:index");
  });

  it("returns formatted recommendations", async () => {
    countListingEmbeddingsMock.mockResolvedValueOnce(10);
    getListingRecommendationsMock.mockResolvedValueOnce(result);

    const response = await recommendationSkill("target", {
      model: "test-model",
    });

    expect(getListingRecommendationsMock).toHaveBeenCalledWith(
      "target",
      { model: "test-model" },
    );
    expect(response.status).toBe("success");
    expect(response.target?.listingId).toBe("target");
    expect(response.recommendations[0]).toMatchObject({
      listingId: "candidate",
      recommendation: {
        totalScore: 98,
      },
    });
    expect(response.message).toContain("Top 1 similar active listings");
    expect(response.message).toContain("Listing ID: candidate");
    expect(response.message).toContain("priced near recent comps");
  });

  it("handles missing target listing", async () => {
    countListingEmbeddingsMock.mockResolvedValueOnce(10);
    getListingRecommendationsMock.mockResolvedValueOnce(null);

    const response = await recommendationSkill("unknown");

    expect(response.status).toBe("not-found");
  });
});
