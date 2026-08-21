import { describe, expect, it } from "vitest";
import {
  buildCreateRagChunksTableQuery,
  buildRagCandidateQuery,
} from "../src/db/rag";

describe("RAG database SQL", () => {
  it("creates a chunk table keyed by document, position, and model", () => {
    const sql = buildCreateRagChunksTableQuery();
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS rag_chunks");
    expect(sql).toContain("PRIMARY KEY (document_id, chunk_index, model)");
    expect(sql).toContain("embedding_json MEDIUMTEXT");
  });

  it("builds a parameterized and safely bounded candidate query", () => {
    const query = buildRagCandidateQuery("test-model", 200_000);
    expect(query.params).toEqual(["test-model", 100_000]);
    expect(query.sql).toContain("WHERE model = ?");
    expect(query.sql).toContain("LIMIT ?");
  });
});
