import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeDocument } from "../src/types/rag";

const {
  deleteStaleRagChunksMock,
  ensureRagChunksTableMock,
  getExistingRagChunkHashesMock,
  upsertRagChunksMock,
} = vi.hoisted(() => ({
  deleteStaleRagChunksMock: vi.fn(),
  ensureRagChunksTableMock: vi.fn(),
  getExistingRagChunkHashesMock: vi.fn(),
  upsertRagChunksMock: vi.fn(),
}));

vi.mock("../src/db/rag", () => ({
  deleteStaleRagChunks: deleteStaleRagChunksMock,
  ensureRagChunksTable: ensureRagChunksTableMock,
  getExistingRagChunkHashes: getExistingRagChunkHashesMock,
  upsertRagChunks: upsertRagChunksMock,
}));

import { indexKnowledgeBase } from "../src/rag/indexKnowledge";

const document: KnowledgeDocument = {
  id: "glossary",
  title: "Glossary",
  content: "# Glossary\n\nDOM means Days on Market.",
  sourcePath: "/tmp/glossary.md",
  sourceUrl: null,
};

describe("indexKnowledgeBase", () => {
  beforeEach(() => {
    deleteStaleRagChunksMock.mockReset().mockResolvedValue(undefined);
    ensureRagChunksTableMock.mockReset().mockResolvedValue(undefined);
    getExistingRagChunkHashesMock.mockReset().mockResolvedValue(new Map());
    upsertRagChunksMock.mockReset().mockResolvedValue(undefined);
  });

  it("embeds changed chunks as documents and upserts them", async () => {
    const embeddingProvider = vi.fn().mockResolvedValue([[1, 0, 0]]);

    const stats = await indexKnowledgeBase({
      documents: [document],
      model: "test-model",
      embeddingProvider,
    });

    expect(ensureRagChunksTableMock).toHaveBeenCalledOnce();
    expect(embeddingProvider).toHaveBeenCalledWith(
      [expect.stringContaining("DOM means Days on Market")],
      "test-model",
      "document",
    );
    expect(upsertRagChunksMock).toHaveBeenCalledWith([
      expect.objectContaining({
        documentId: "glossary",
        chunkIndex: 0,
        model: "test-model",
        embedding: [1, 0, 0],
      }),
    ]);
    expect(deleteStaleRagChunksMock).toHaveBeenCalledWith("glossary", "test-model", 1);
    expect(stats).toMatchObject({
      documents: 1,
      chunks: 1,
      indexed: 1,
      skipped: 0,
    });
  });

  it("skips an unchanged chunk without calling the embedding provider", async () => {
    const firstProvider = vi.fn().mockResolvedValue([[1, 0]]);
    await indexKnowledgeBase({
      documents: [document],
      model: "test-model",
      embeddingProvider: firstProvider,
    });
    const indexedRecord = upsertRagChunksMock.mock.calls[0][0][0];

    getExistingRagChunkHashesMock.mockResolvedValueOnce(
      new Map([[0, indexedRecord.textHash]]),
    );
    upsertRagChunksMock.mockClear();
    const unchangedProvider = vi.fn();

    const stats = await indexKnowledgeBase({
      documents: [document],
      model: "test-model",
      embeddingProvider: unchangedProvider,
    });

    expect(unchangedProvider).not.toHaveBeenCalled();
    expect(upsertRagChunksMock).not.toHaveBeenCalled();
    expect(stats).toMatchObject({ indexed: 0, skipped: 1 });
  });
});
