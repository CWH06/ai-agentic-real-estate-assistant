import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGroundedContext,
  extractDeepSeekResponseText,
  extractOpenAIResponseText,
  generateGroundedAnswer,
  INSUFFICIENT_CONTEXT_MESSAGE,
} from "../src/rag/generateGroundedAnswer";
import type { RetrievedKnowledgeChunk } from "../src/types/rag";

const chunk: RetrievedKnowledgeChunk = {
  documentId: "real-estate-glossary",
  documentTitle: "Real Estate Glossary",
  sourceUrl: null,
  chunkIndex: 2,
  content: "DOM means Days on Market.",
  textHash: "hash",
  model: "test-embedding-model",
  embedding: [1, 0],
  similarity: 0.95,
};

describe("grounded answer helpers", () => {
  it("labels every retrieved context chunk with source metadata", () => {
    const context = buildGroundedContext([chunk]);
    expect(context).toContain("[Context 1]");
    expect(context).toContain("Source title: Real Estate Glossary");
    expect(context).toContain("DOM means Days on Market.");
  });

  it("extracts text only from output message blocks", () => {
    expect(extractOpenAIResponseText({
      output: [
        { type: "reasoning", content: [] },
        {
          type: "message",
          content: [{ type: "output_text", text: "Grounded answer" }],
        },
      ],
    })).toBe("Grounded answer");
  });

  it("extracts DeepSeek chat completion text", () => {
    expect(extractDeepSeekResponseText({
      choices: [{ message: { content: "DeepSeek answer" } }],
    })).toBe("DeepSeek answer");
  });
});

describe("generateGroundedAnswer", () => {
  const originalEnvironment = {
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
  };

  beforeEach(() => {
    process.env.LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-key";
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    vi.unstubAllGlobals();
  });

  it("returns the safe fallback without calling an LLM when context is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateGroundedAnswer("Unknown?", [])).resolves.toBe(
      INSUFFICIENT_CONTEXT_MESSAGE,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the Responses API with only the question and retrieved context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: "DOM means Days on Market. [Source: Real Estate Glossary]",
        }],
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateGroundedAnswer(
      "What does DOM mean?",
      [chunk],
      { model: "test-chat-model" },
    );

    expect(answer).toContain("DOM means Days on Market");
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "test-chat-model",
      store: false,
      reasoning: { effort: "low" },
    });
    expect(String(body.input)).toContain("What does DOM mean?");
    expect(String(body.input)).toContain("DOM means Days on Market.");
  });

  it("uses DeepSeek Chat Completions when LLM_PROVIDER=deepseek", async () => {
    process.env.LLM_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.com/";
    process.env.DEEPSEEK_MODEL = "deepseek-v4-flash";

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          content: "DOM means Days on Market. [Source: Real Estate Glossary]",
        },
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateGroundedAnswer("What does DOM mean?", [chunk]);

    expect(answer).toContain("DOM means Days on Market");
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    const body = JSON.parse(String(request.body)) as {
      model: string;
      thinking: { type: string };
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[1].content).toContain("What does DOM mean?");
    expect(body.messages[1].content).toContain("DOM means Days on Market.");
  });

  it("surfaces a helpful API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("bad request", { status: 400 }),
    ));

    await expect(generateGroundedAnswer("What is DOM?", [chunk])).rejects.toThrow(
      "OpenAI Responses request failed: 400",
    );
  });
});
