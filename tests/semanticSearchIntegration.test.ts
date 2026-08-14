import { afterAll, describe, expect, it } from "vitest";
import { query, closePool } from "../src/db/mysql";
import {
  ensureListingEmbeddingsTable,
  searchSemanticListings,
  upsertListingEmbeddings,
} from "../src/db/semanticSearch";

const runDbTests = process.env.RUN_DB_TESTS === "1";
const testModel = `test-semantic-${process.pid}`;

interface ActiveListingIdRow {
  L_ListingID: string;
}

describe.skipIf(!runDbTests)("semantic search database integration", () => {
  afterAll(async () => {
    await query(
      "DELETE FROM listing_embeddings WHERE model = ?",
      [testModel],
    );
    await closePool();
  });

  it("searches active listings using indexed embeddings", async () => {
    await ensureListingEmbeddingsTable();

    const rows = await query<ActiveListingIdRow>(
      `
        SELECT L_ListingID
        FROM rets_property
        WHERE L_Status = ?
          AND L_ListingID IS NOT NULL
        ORDER BY id ASC
        LIMIT 3
      `.trim(),
      ["Active"],
    );

    expect(rows.length).toBe(3);

    await upsertListingEmbeddings([
      {
        listingId: rows[0].L_ListingID,
        model: testModel,
        textHash: "hash-a",
        embedding: [1, 0, 0],
      },
      {
        listingId: rows[1].L_ListingID,
        model: testModel,
        textHash: "hash-b",
        embedding: [0.8, 0.2, 0],
      },
      {
        listingId: rows[2].L_ListingID,
        model: testModel,
        textHash: "hash-c",
        embedding: [0, 1, 0],
      },
    ]);

    const matches = await searchSemanticListings(
      "mountain view craftsman",
      {
        model: testModel,
        topK: 2,
        embeddingProvider: async () => [[1, 0, 0]],
      },
    );

    expect(matches.map((match) => match.L_ListingID)).toEqual([
      rows[0].L_ListingID,
      rows[1].L_ListingID,
    ]);
    expect(matches[0].similarity).toBeCloseTo(1);
  });
});
