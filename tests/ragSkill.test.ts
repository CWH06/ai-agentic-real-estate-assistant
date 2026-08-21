import { describe, expect, it, vi } from "vitest";
import {
  formatRagSources,
  ragSkill,
  sourcesFromChunks,
} from "../src/skills/rag";
import {
  INSUFFICIENT_CONTEXT_MESSAGE,
} from "../src/rag/generateGroundedAnswer";
import type { RetrievedKnowledgeChunk } from "../src/types/rag";

function retrieved(
  documentId: string,
  similarity = 0.9,
  chunkIndex = 0,
): RetrievedKnowledgeChunk {
  return {
    documentId,
    documentTitle: `${documentId} title`,
    sourceUrl: documentId === "linked" ? "https://example.com/source" : null,
    chunkIndex,
    content: `${documentId} content`,
    textHash: "hash",
    model: "test-model",
    embedding: [1, 0],
    similarity,
  };
}

describe("RAG source formatting", () => {
  it("deduplicates documents and keeps their best similarity", () => {
    const sources = sourcesFromChunks([
      retrieved("glossary", 0.8, 0),
      retrieved("glossary", 0.95, 1),
      retrieved("linked", 0.9, 0),
    ]);

    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({ documentId: "glossary", similarity: 0.95 });
    expect(formatRagSources(sources)).toContain(
      "linked title: https://example.com/source",
    );
  });
});

describe("ragSkill", () => {
  it("asks for a question when input is blank", async () => {
    const result = await ragSkill("  ");
    expect(result.status).toBe("needs-question");
    expect(result.sources).toEqual([]);
  });

  it("retrieves four chunks, generates a grounded answer, and lists sources", async () => {
    const chunks = [retrieved("glossary"), retrieved("metrics", 0.85)];
    const retriever = vi.fn().mockResolvedValue(chunks);
    const answerProvider = vi.fn().mockResolvedValue(
      "DOM means Days on Market. [Source: glossary title]",
    );

    const result = await ragSkill("What does DOM mean?", {
      model: "test-model",
      chatModel: "test-chat-model",
      retriever,
      answerProvider,
    });

    expect(retriever).toHaveBeenCalledWith(
      "What does DOM mean?",
      expect.objectContaining({ topK: 4, model: "test-model" }),
    );
    expect(answerProvider).toHaveBeenCalledWith(
      "What does DOM mean?",
      chunks,
      { model: "test-chat-model" },
    );
    expect(result.status).toBe("success");
    expect(result.message).toContain("Sources:\n- glossary title");
    expect(result.sources).toHaveLength(2);
  });

  it("explains when the knowledge index has not been created", async () => {
    const result = await ragSkill("What is DOM?", {
      retriever: vi.fn().mockResolvedValue([]),
      indexedChunkCounter: vi.fn().mockResolvedValue(0),
    });

    expect(result.status).toBe("not-indexed");
    expect(result.message).toContain("npm run rag:index");
  });

  it("does not call the LLM when retrieval has no relevant context", async () => {
    const answerProvider = vi.fn();
    const result = await ragSkill("Unsupported question", {
      retriever: vi.fn().mockResolvedValue([]),
      indexedChunkCounter: vi.fn().mockResolvedValue(12),
      answerProvider,
    });

    expect(result.status).toBe("insufficient-context");
    expect(result.message).toBe(INSUFFICIENT_CONTEXT_MESSAGE);
    expect(answerProvider).not.toHaveBeenCalled();
  });

  it("marks an expanded insufficient-context answer correctly", async () => {
    const result = await ragSkill("What columns are in an unknown table?", {
      retriever: vi.fn().mockResolvedValue([retrieved("glossary")]),
      answerProvider: vi.fn().mockResolvedValue(
        `${INSUFFICIENT_CONTEXT_MESSAGE} The retrieved source does not list that table.`,
      ),
    });

    expect(result.status).toBe("insufficient-context");
  });

  it("returns a stable user-facing error when a dependency fails", async () => {
    const result = await ragSkill("What is DOM?", {
      retriever: vi.fn().mockRejectedValue(new Error("database offline")),
    });

    expect(result.status).toBe("error");
    expect(result.sources).toEqual([]);
  });
});
