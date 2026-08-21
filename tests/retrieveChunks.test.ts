import { describe, expect, it, vi } from "vitest";
import {
  lexicalRetrievalBoost,
  rankKnowledgeChunks,
  retrieveRelevantChunks,
} from "../src/rag/retrieveChunks";
import type { RagChunkRecord } from "../src/types/rag";

function record(
  documentId: string,
  chunkIndex: number,
  embedding: number[],
): RagChunkRecord {
  return {
    documentId,
    documentTitle: `${documentId} title`,
    sourceUrl: null,
    chunkIndex,
    content: `${documentId} content`,
    textHash: "hash",
    model: "test-model",
    embedding,
  };
}

describe("rankKnowledgeChunks", () => {
  it("sorts by cosine similarity, filters weak matches, and applies top K", () => {
    const results = rankKnowledgeChunks(
      [1, 0],
      [
        record("weak", 0, [0, 1]),
        record("best", 0, [1, 0]),
        record("second", 0, [0.8, 0.2]),
      ],
      2,
      0.1,
    );

    expect(results.map((result) => result.documentId)).toEqual(["best", "second"]);
    expect(results[0].similarity).toBeCloseTo(1);
  });

  it("uses exact schema keywords to promote a relevant column chunk", () => {
    const general = record("general-glossary", 0, [1, 0]);
    const schema = {
      ...record("california-sold-schema", 0, [0.8, 0.2]),
      content: "california_sold columns include ListingKey and ClosePrice.",
    };

    expect(lexicalRetrievalBoost("What columns are in california_sold?", schema))
      .toBeGreaterThan(0);

    const results = rankKnowledgeChunks(
      [1, 0],
      [general, schema],
      2,
      0,
      "What columns are in california_sold?",
    );

    expect(results[0].documentId).toBe("california-sold-schema");
  });
});

describe("retrieveRelevantChunks", () => {
  it("embeds the question as a query and retrieves four by default", async () => {
    const embeddingProvider = vi.fn().mockResolvedValue([[1, 0]]);
    const candidateProvider = vi.fn().mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => record(
        `doc-${index}`,
        0,
        [1, index / 10],
      )),
    );

    const results = await retrieveRelevantChunks("  What does DOM mean?  ", {
      model: "test-model",
      minSimilarity: -1,
      embeddingProvider,
      candidateProvider,
    });

    expect(embeddingProvider).toHaveBeenCalledWith(
      ["What does DOM mean?"],
      "test-model",
      "query",
    );
    expect(candidateProvider).toHaveBeenCalledWith("test-model", 10_000);
    expect(results).toHaveLength(4);
  });

  it("does not call providers for a blank question", async () => {
    const embeddingProvider = vi.fn();
    await expect(retrieveRelevantChunks(" ", { embeddingProvider })).resolves.toEqual([]);
    expect(embeddingProvider).not.toHaveBeenCalled();
  });
});
