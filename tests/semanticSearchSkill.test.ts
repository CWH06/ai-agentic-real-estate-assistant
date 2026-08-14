import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SemanticListingMatch } from "../src/db/semanticSearch";

const { searchSemanticListingsMock, countListingEmbeddingsMock } = vi.hoisted(
  () => ({
    searchSemanticListingsMock: vi.fn(),
    countListingEmbeddingsMock: vi.fn(),
  }),
);

vi.mock("../src/db/semanticSearch", () => ({
  searchSemanticListings: searchSemanticListingsMock,
  countListingEmbeddings: countListingEmbeddingsMock,
}));

import { semanticSearchSkill } from "../src/skills/semantic-search";

const match: SemanticListingMatch = {
  L_ListingID: "123",
  L_DisplayId: "MLS123",
  L_Address: "12 Canyon Road",
  L_City: "Irvine",
  L_Zip: "92618",
  price: 1_250_000,
  beds: 3,
  baths: 2.5,
  sqft: 1800,
  type: "SingleFamilyResidence",
  status: "Active",
  lat: null,
  lng: null,
  YearBuilt: 1998,
  AssociationFee: null,
  DaysOnMarket: 12,
  PoolPrivateYN: "0",
  ViewYN: "1",
  FireplaceYN: "1",
  PhotoCount: 30,
  LA1_UserFirstName: "Test",
  LA1_UserLastName: "Agent",
  LO1_OrganizationName: "Test Realty",
  similarity: 0.91,
  embeddingModel: "test-model",
};

describe("semanticSearchSkill", () => {
  beforeEach(() => {
    searchSemanticListingsMock.mockReset();
    countListingEmbeddingsMock.mockReset();
  });

  it("asks for a query when the input is empty", async () => {
    await expect(semanticSearchSkill("   ")).resolves.toEqual({
      status: "needs-query",
      message: "What kind of property are you looking for?",
      query: "",
      listings: [],
    });
  });

  it("returns formatted semantic listings", async () => {
    searchSemanticListingsMock.mockResolvedValueOnce([match]);

    const result = await semanticSearchSkill(
      "charming home with mountain views",
      { model: "test-model" },
    );

    expect(searchSemanticListingsMock).toHaveBeenCalledWith(
      "charming home with mountain views",
      { model: "test-model" },
    );
    expect(result.status).toBe("success");
    expect(result.listings[0]).toMatchObject({
      listingId: "123",
      similarity: 0.91,
    });
    expect(result.message).toContain("I found 1 semantically similar listings");
    expect(result.message).toContain("Listing ID: 123");
    expect(result.message).toContain("Similarity: 91%");
  });

  it("explains when embeddings have not been indexed", async () => {
    searchSemanticListingsMock.mockResolvedValueOnce([]);
    countListingEmbeddingsMock.mockResolvedValueOnce(0);

    const result = await semanticSearchSkill("craftsman with views");

    expect(result.status).toBe("not-indexed");
    expect(result.message).toContain("Run npm run embeddings:index");
  });

  it("returns an error status when search fails", async () => {
    searchSemanticListingsMock.mockRejectedValueOnce(new Error("boom"));

    const result = await semanticSearchSkill("craftsman with views");

    expect(result.status).toBe("error");
    expect(result.listings).toEqual([]);
  });
});
