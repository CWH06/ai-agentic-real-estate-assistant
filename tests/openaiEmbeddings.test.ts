import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cosineSimilarity,
  createVoyageEmbeddings,
  getEmbeddingModel,
  getEmbeddingProviderName,
  hashEmbeddingText,
  normalizeEmbeddingInput,
  parseEmbeddingJson,
  serializeEmbedding,
} from "../src/embeddings/openaiEmbeddings";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe("embedding utilities", () => {
  it("normalizes embedding input", () => {
    expect(normalizeEmbeddingInput("  charming\n\nhome   with views  ")).toBe(
      "charming home with views",
    );
  });

  it("hashes normalized embedding text", () => {
    expect(hashEmbeddingText("hello   world")).toBe(
      hashEmbeddingText(" hello world "),
    );
  });

  it("serializes and parses embedding vectors", () => {
    const vector = [0.1, 0.2, 0.3];
    expect(parseEmbeddingJson(serializeEmbedding(vector))).toEqual(vector);
    expect(parseEmbeddingJson("not json")).toBeNull();
    expect(parseEmbeddingJson(JSON.stringify(["bad"]))).toBeNull();
  });

  it("calculates cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 1], [1, 1])).toBeCloseTo(1);
  });

  it("selects Voyage when VOYAGE_API_KEY is configured", () => {
    delete process.env.EMBEDDING_PROVIDER;
    process.env.VOYAGE_API_KEY = "pa-test";
    process.env.VOYAGE_EMBEDDING_MODEL = "voyage-4-lite";

    expect(getEmbeddingProviderName()).toBe("voyage");
    expect(getEmbeddingModel()).toBe("voyage-4-lite");
  });

  it("lets EMBEDDING_PROVIDER force OpenAI", () => {
    process.env.EMBEDDING_PROVIDER = "openai";
    process.env.VOYAGE_API_KEY = "pa-test";
    process.env.OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

    expect(getEmbeddingProviderName()).toBe("openai");
    expect(getEmbeddingModel()).toBe("text-embedding-3-small");
  });

  it("calls the Voyage embeddings endpoint", async () => {
    process.env.VOYAGE_API_KEY = "pa-test";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              embedding: [0.1, 0.2],
              index: 0,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const embeddings = await createVoyageEmbeddings(
      ["sample text"],
      "voyage-4-lite",
      "document",
    );

    expect(embeddings).toEqual([[0.1, 0.2]]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.voyageai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer pa-test",
        }),
      }),
    );

    const body = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    ) as Record<string, unknown>;

    expect(body).toMatchObject({
      model: "voyage-4-lite",
      input: ["sample text"],
      input_type: "document",
      output_dtype: "float",
    });
  });
});
