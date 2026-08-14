import { afterAll, describe, expect, it } from "vitest";
import { closePool, query } from "../src/db/mysql";
import {
  getListingRecommendations,
  validateWithComps,
} from "../src/db/recommendations";
import {
  ensureListingEmbeddingsTable,
  upsertListingEmbeddings,
} from "../src/db/semanticSearch";

const runDbTests = process.env.RUN_DB_TESTS === "1";
const testModel = `test-recommendations-${process.pid}`;

interface ActiveListingRow {
  L_ListingID: string;
  L_City: string | null;
  L_SystemPrice: number | null;
  LM_Int2_3: number | null;
}

describe.skipIf(!runDbTests)("recommendations database integration", () => {
  afterAll(async () => {
    await query(
      "DELETE FROM listing_embeddings WHERE model = ?",
      [testModel],
    );
    await closePool();
  });

  it("recommends similar indexed active listings", async () => {
    await ensureListingEmbeddingsTable();

    const rows = await query<ActiveListingRow>(
      `
        SELECT L_ListingID, L_City, L_SystemPrice, LM_Int2_3
        FROM rets_property
        WHERE L_Status = ?
          AND L_ListingID IS NOT NULL
          AND L_City = ?
          AND L_SystemPrice IS NOT NULL
          AND LM_Int2_3 IS NOT NULL
        ORDER BY id ASC
        LIMIT 4
      `.trim(),
      ["Active", "Irvine"],
    );

    expect(rows.length).toBeGreaterThanOrEqual(3);

    await upsertListingEmbeddings([
      {
        listingId: rows[0].L_ListingID,
        model: testModel,
        textHash: "target",
        embedding: [1, 0, 0],
      },
      {
        listingId: rows[1].L_ListingID,
        model: testModel,
        textHash: "best",
        embedding: [0.98, 0.02, 0],
      },
      {
        listingId: rows[2].L_ListingID,
        model: testModel,
        textHash: "second",
        embedding: [0.7, 0.3, 0],
      },
    ]);

    const result = await getListingRecommendations(
      rows[0].L_ListingID,
      {
        model: testModel,
        topK: 2,
        candidateLimit: 10,
        compMonths: 60,
      },
    );

    expect(result).not.toBeNull();
    expect(result?.target.L_ListingID).toBe(rows[0].L_ListingID);
    expect(result?.recommendations.length).toBe(2);
    expect(
      result?.recommendations.map((listing) => listing.L_ListingID),
    ).toEqual(
      expect.arrayContaining([
        rows[1].L_ListingID,
      ]),
    );
    expect(result?.recommendations[0].recommendation.totalScore).toBeGreaterThan(0);
    expect(result?.recommendations[0].compValidation.city).toBe("Irvine");
  });

  it("validates a listing against sold comps", async () => {
    const rows = await query<ActiveListingRow>(
      `
        SELECT L_ListingID, L_City, L_SystemPrice, LM_Int2_3
        FROM rets_property
        WHERE L_Status = ?
          AND L_City = ?
          AND L_SystemPrice IS NOT NULL
          AND LM_Int2_3 IS NOT NULL
        ORDER BY id ASC
        LIMIT 1
      `.trim(),
      ["Active", "Irvine"],
    );

    const validation = await validateWithComps({
      L_ListingID: rows[0].L_ListingID,
      L_DisplayId: rows[0].L_ListingID,
      L_Address: null,
      L_City: rows[0].L_City,
      L_Zip: null,
      price: rows[0].L_SystemPrice,
      beds: null,
      baths: null,
      sqft: rows[0].LM_Int2_3,
      type: null,
      status: "Active",
      lat: null,
      lng: null,
      YearBuilt: null,
      AssociationFee: null,
      DaysOnMarket: null,
      PoolPrivateYN: null,
      ViewYN: null,
      FireplaceYN: null,
      PhotoCount: null,
      LA1_UserFirstName: null,
      LA1_UserLastName: null,
      LO1_OrganizationName: null,
    }, 60);

    expect(validation.city).toBe("Irvine");
    expect(validation.compCount).toBeGreaterThanOrEqual(0);
    expect(validation.assessment).toBeTruthy();
  });
});
