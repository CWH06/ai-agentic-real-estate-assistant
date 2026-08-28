import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  handlePropertySearchMock,
  marketStatsSkillMock,
  ragSkillMock,
  recommendationSkillMock,
  semanticSearchSkillMock,
} = vi.hoisted(() => ({
  handlePropertySearchMock: vi.fn(),
  marketStatsSkillMock: vi.fn(),
  ragSkillMock: vi.fn(),
  recommendationSkillMock: vi.fn(),
  semanticSearchSkillMock: vi.fn(),
}));

vi.mock("../src/skills/property-search/conversation", () => ({
  handlePropertySearch: handlePropertySearchMock,
}));

vi.mock("../src/skills/market-stats", () => ({
  marketStatsSkill: marketStatsSkillMock,
}));

vi.mock("../src/skills/recommendations", () => ({
  recommendationSkill: recommendationSkillMock,
}));

vi.mock("../src/skills/rag", () => ({
  ragSkill: ragSkillMock,
}));

vi.mock("../src/skills/semantic-search", () => ({
  semanticSearchSkill: semanticSearchSkillMock,
}));

import {
  detectChatIntent,
  handleChatMessage,
} from "../src/chat/router";

describe("detectChatIntent", () => {
  it("detects help", () => {
    expect(detectChatIntent("help")).toBe("help");
  });

  it("detects market stats", () => {
    expect(detectChatIntent("market stats for Irvine")).toBe("market-stats");
    expect(detectChatIntent("median price in Pasadena")).toBe("market-stats");
  });

  it("detects knowledge questions before overlapping market keywords", () => {
    expect(detectChatIntent("What does DOM mean?")).toBe("knowledge");
    expect(detectChatIntent("What columns are in california_sold?")).toBe("knowledge");
    expect(detectChatIntent("What is a list-to-close ratio?")).toBe("knowledge");
  });

  it("detects recommendations", () => {
    expect(detectChatIntent("recommend similar to 1118398412")).toBe("recommendations");
    expect(detectChatIntent("more like listing 1118398412")).toBe("recommendations");
    expect(detectChatIntent("similar to 17417")).toBe("recommendations");
  });

  it("detects semantic search", () => {
    expect(detectChatIntent("semantic search: charming craftsman")).toBe("semantic-search");
    expect(detectChatIntent("quiet retreat with mountain views")).toBe("semantic-search");
  });

  it("defaults to property search", () => {
    expect(detectChatIntent("Find homes in Irvine")).toBe("property-search");
  });
});

describe("handleChatMessage", () => {
  beforeEach(() => {
    handlePropertySearchMock.mockReset();
    marketStatsSkillMock.mockReset();
    ragSkillMock.mockReset();
    recommendationSkillMock.mockReset();
    semanticSearchSkillMock.mockReset();
  });

  it("routes property search turns", async () => {
    handlePropertySearchMock.mockResolvedValueOnce({
      message: "What is your budget?",
      done: false,
    });

    const reply = await handleChatMessage({
      userId: "user-1",
      text: "Find homes in Irvine",
    });

    expect(reply).toEqual({
      userId: "user-1",
      text: "What is your budget?",
      intent: "property-search",
    });
    expect(handlePropertySearchMock).toHaveBeenCalledWith(
      "user-1",
      "Find homes in Irvine",
    );
  });

  it("routes market stats", async () => {
    marketStatsSkillMock.mockResolvedValueOnce({
      message: "Market report: Irvine",
    });

    const reply = await handleChatMessage({
      userId: "user-1",
      text: "market stats for Irvine",
    });

    expect(reply.intent).toBe("market-stats");
    expect(reply.text).toBe("Market report: Irvine");
  });

  it("routes knowledge questions to the RAG skill", async () => {
    ragSkillMock.mockResolvedValueOnce({
      message: "DOM means Days on Market.\n\nSources:\n- Real Estate Glossary",
    });

    const reply = await handleChatMessage({
      userId: "user-1",
      text: "What does DOM mean?",
    });

    expect(reply.intent).toBe("knowledge");
    expect(ragSkillMock).toHaveBeenCalledWith("What does DOM mean?");
    expect(marketStatsSkillMock).not.toHaveBeenCalled();
  });

  it("routes recommendations with extracted listing id", async () => {
    recommendationSkillMock.mockResolvedValueOnce({
      message: "Top similar active listings",
    });

    const reply = await handleChatMessage({
      userId: "user-1",
      text: "recommend similar to 1118398412",
    });

    expect(reply.intent).toBe("recommendations");
    expect(recommendationSkillMock).toHaveBeenCalledWith("1118398412");
  });

  it("routes shorter listing-like ids to recommendations instead of property search", async () => {
    recommendationSkillMock.mockResolvedValueOnce({
      message: "I could not find an active indexed listing for that listing id.",
    });

    const reply = await handleChatMessage({
      userId: "user-1",
      text: "similar to 17417",
    });

    expect(reply.intent).toBe("recommendations");
    expect(recommendationSkillMock).toHaveBeenCalledWith("17417");
    expect(handlePropertySearchMock).not.toHaveBeenCalled();
  });

  it("routes semantic search with prefix stripped", async () => {
    semanticSearchSkillMock.mockResolvedValueOnce({
      message: "I found semantic matches",
    });

    const reply = await handleChatMessage({
      userId: "user-1",
      text: "semantic search: charming craftsman",
    });

    expect(reply.intent).toBe("semantic-search");
    expect(semanticSearchSkillMock).toHaveBeenCalledWith("charming craftsman");
  });
});
