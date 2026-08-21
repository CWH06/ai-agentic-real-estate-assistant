import { describe, expect, it } from "vitest";
import {
  chunkKnowledgeDocument,
  chunkMarkdownText,
  chunkText,
  DEFAULT_RAG_CHUNK_OVERLAP,
  DEFAULT_RAG_CHUNK_SIZE,
} from "../src/rag/chunkText";
import type { KnowledgeDocument } from "../src/types/rag";

describe("chunkText", () => {
  it("returns no chunks for blank input", () => {
    expect(chunkText("  \n\n ")).toEqual([]);
  });

  it("creates bounded overlapping chunks with the Week 8 defaults", () => {
    const paragraphs = Array.from(
      { length: 30 },
      (_, index) => `Paragraph ${index} explains a project field with enough words to make retrieval useful.`,
    );
    const text = paragraphs.join("\n\n");
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= DEFAULT_RAG_CHUNK_SIZE)).toBe(true);
    expect(chunks.every(Boolean)).toBe(true);
    expect(DEFAULT_RAG_CHUNK_OVERLAP).toBe(100);

    const firstEndingWords = chunks[0].split(/\s+/).slice(-5);
    expect(firstEndingWords.some((word) => chunks[1].includes(word))).toBe(true);
    expect(chunks.at(-1)).toContain("Paragraph 29");
  });

  it("validates chunk options", () => {
    expect(() => chunkText("content", { chunkSize: 0 })).toThrow("chunkSize");
    expect(() => chunkText("content", { chunkSize: 10, overlap: 10 })).toThrow("overlap");
  });
});

describe("chunkKnowledgeDocument", () => {
  it("adds stable document metadata and text hashes", () => {
    const document: KnowledgeDocument = {
      id: "glossary",
      title: "Glossary",
      content: "# Glossary\n\nDOM means Days on Market.",
      sourcePath: "/tmp/glossary.md",
      sourceUrl: null,
    };

    const [chunk] = chunkKnowledgeDocument(document);
    expect(chunk).toMatchObject({
      documentId: "glossary",
      documentTitle: "Glossary",
      chunkIndex: 0,
    });
    expect(chunk.textHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("repeats a Markdown section heading in every chunk", () => {
    const content = [
      "## california_sold columns",
      Array.from(
        { length: 30 },
        (_, index) => `Field${index} is a documented california_sold column.`,
      ).join(" "),
    ].join("\n\n");

    const chunks = chunkMarkdownText(content, { chunkSize: 220, overlap: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.startsWith("## california_sold columns\n"))).toBe(true);
    expect(chunks.every((chunk) => chunk.length <= 220)).toBe(true);
  });
});
