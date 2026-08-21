import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadKnowledgeDocuments } from "../src/rag/loadKnowledgeDocuments";

describe("loadKnowledgeDocuments", () => {
  it("loads only Markdown files in deterministic order", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "rag-documents-"));

    try {
      await Promise.all([
        writeFile(path.join(directory, "b.md"), "# Beta\n\nSecond document."),
        writeFile(
          path.join(directory, "a.md"),
          "# Alpha\n\nCanonical source: https://example.com/alpha\n\nFirst document.",
        ),
        writeFile(path.join(directory, "ignored.txt"), "not indexed"),
      ]);

      const documents = await loadKnowledgeDocuments(directory);

      expect(documents.map((document) => document.id)).toEqual(["a", "b"]);
      expect(documents[0]).toMatchObject({
        title: "Alpha",
        sourceUrl: "https://example.com/alpha",
      });
      expect(documents[1].sourcePath).toBe(path.join(directory, "b.md"));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
