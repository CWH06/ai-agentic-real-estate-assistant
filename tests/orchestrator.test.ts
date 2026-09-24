import { describe, expect, it, vi } from "vitest";
import {
  classifyIntent,
  extractRecommendationListingId,
  formatCombinedResponse,
  hasPendingPropertySearchFollowUp,
  orchestrate,
  type OrchestratorAgents,
  type OrchestratorPart,
} from "../src/orchestrator";
import { clearSession, updateSession } from "../src/skills/property-search/session";

function createAgents(): OrchestratorAgents {
  return {
    semanticSearchAgent: vi.fn(async () => ({ message: "Semantic matches." })),
    propertySearchAgent: vi.fn(async () => ({
      message: "I found matching listings.",
    })),
    marketStatsAgent: vi.fn(async () => ({
      message: "Market report: Pasadena prices are rising.",
    })),
    recommendationAgent: vi.fn(async () => ({
      message: "Top similar active listings.",
    })),
    ragAgent: vi.fn(async () => ({
      message: "DOM means Days on Market.",
    })),
    emailDraftAgent: vi.fn(async () => ({
      message: "Draft prepared. No email was sent.",
    })),
  };
}

describe("classifyIntent", () => {
  it("routes knowledge questions before overlapping market keywords", () => {
    expect(classifyIntent("What does DOM mean?")).toBe("knowledge");
    expect(classifyIntent("What columns are in california_sold?")).toBe("knowledge");
    expect(classifyIntent("What is a list-to-close ratio?")).toBe("knowledge");
  });

  it("routes regular market questions to market stats", () => {
    expect(classifyIntent("average DOM in Irvine over 12 months")).toBe("market");
    expect(classifyIntent("market stats for Irvine")).toBe("market");
  });

  it("detects mixed search and market questions", () => {
    expect(
      classifyIntent("Find affordable homes in Pasadena and tell me whether prices are rising."),
    ).toBe("mixed");
  });

  it("routes property search reset phrases to search", () => {
    expect(classifyIntent("reset")).toBe("search");
    expect(classifyIntent("start over")).toBe("search");
  });

  it("detects recommendations and email drafts", () => {
    expect(classifyIntent("similar to 1118398412")).toBe("recommend");
    expect(classifyIntent("draft an email with this market report")).toBe("email-draft");
  });
});

describe("extractRecommendationListingId", () => {
  it("extracts listing ids from recommendation prompts", () => {
    expect(extractRecommendationListingId("similar to 1118398412")).toBe("1118398412");
    expect(extractRecommendationListingId("more like listing 1169342979")).toBe("1169342979");
  });
});

describe("formatCombinedResponse", () => {
  it("formats mixed agent parts with section titles", () => {
    const parts: OrchestratorPart[] = [
      {
        intent: "search",
        title: "Property matches",
        message: "Listing results",
      },
      {
        intent: "market",
        title: "Market summary",
        message: "Market results",
      },
    ];

    expect(formatCombinedResponse(parts)).toBe(
      "Property matches:\nListing results\n\nMarket summary:\nMarket results",
    );
  });
});

describe("orchestrate", () => {
  it("routes descriptions to semantic search without a command prefix", async () => {
    const agents = createAgents();
    const result = await orchestrate("Semantic search: quiet home with a pool", "semantic-user", { agents });
    expect(result.intent).toBe("semantic");
    expect(agents.semanticSearchAgent).toHaveBeenCalledWith("quiet home with a pool");
    expect(agents.propertySearchAgent).not.toHaveBeenCalled();
  });

  it("routes bare approval to the injected email workflow", async () => {
    const agents = createAgents();
    const result = await orchestrate("confirm", "approval-user", { agents });
    expect(result.intent).toBe("email-draft");
    expect(agents.emailDraftAgent).toHaveBeenCalledWith("confirm", "approval-user");
  });

  it("serves help without calling external agents", async () => {
    const agents = createAgents();
    const result = await orchestrate("help", "help-user", { agents });
    expect(result.intent).toBe("help");
    expect(result.message).toContain("CONFIRM EMAIL");
    for (const agent of Object.values(agents)) expect(agent).not.toHaveBeenCalled();
  });
  it("routes search intent to the property search agent", async () => {
    const agents = createAgents();
    const result = await orchestrate("Find homes in Irvine", "user-1", {
      agents,
    });

    expect(result.intent).toBe("search");
    expect(result.message).toBe("I found matching listings.");
    expect(agents.propertySearchAgent).toHaveBeenCalledWith(
      "Find homes in Irvine",
      "user-1",
    );
  });

  it("routes short follow-up answers back to an active property search", async () => {
    const agents = createAgents();
    const userId = "property-follow-up-user";
    clearSession(userId);
    updateSession(userId, {
      conversationStep: 1,
      filters: {
        city: "Irvine",
        maxPrice: 2_000_000,
        beds: null,
        baths: null,
        sqft: null,
        type: "SingleFamilyResidence",
        pool: null,
        hasView: null,
        maxHoa: null,
      },
    });

    expect(classifyIntent("3")).toBe("fallback");
    expect(hasPendingPropertySearchFollowUp(userId)).toBe(true);

    const result = await orchestrate("3", userId, { agents });

    expect(result.intent).toBe("search");
    expect(agents.propertySearchAgent).toHaveBeenCalledWith("3", userId);
    clearSession(userId);
  });

  it("routes reset to the property search agent after a completed search", async () => {
    const agents = createAgents();
    const userId = "orchestrator-reset-user";
    clearSession(userId);
    updateSession(userId, {
      conversationStep: 4,
      filters: {
        city: "Pasadena",
        maxPrice: 1_000_000,
        beds: 4,
        baths: null,
        sqft: null,
        type: "SingleFamilyResidence",
        pool: null,
        hasView: null,
        maxHoa: null,
      },
    });

    const result = await orchestrate("reset", userId, { agents });

    expect(result.intent).toBe("search");
    expect(agents.propertySearchAgent).toHaveBeenCalledWith("reset", userId);
    clearSession(userId);
  });

  it("routes market intent to the market stats agent", async () => {
    const agents = createAgents();
    const result = await orchestrate("market stats for Irvine", "user-1", {
      agents,
    });

    expect(result.intent).toBe("market");
    expect(agents.marketStatsAgent).toHaveBeenCalledWith("market stats for Irvine");
  });

  it("routes recommendation intent with the extracted listing id", async () => {
    const agents = createAgents();
    const result = await orchestrate("recommend similar to 1118398412", "user-1", {
      agents,
    });

    expect(result.intent).toBe("recommend");
    expect(agents.recommendationAgent).toHaveBeenCalledWith("1118398412");
  });

  it("routes knowledge intent to the RAG agent", async () => {
    const agents = createAgents();
    const result = await orchestrate("What does DOM mean?", "user-1", {
      agents,
    });

    expect(result.intent).toBe("knowledge");
    expect(agents.ragAgent).toHaveBeenCalledWith("What does DOM mean?");
    expect(agents.marketStatsAgent).not.toHaveBeenCalled();
  });

  it("routes an explicit email decision to the email agent", async () => {
    const agents = createAgents();
    const result = await orchestrate("CONFIRM EMAIL", "user-1", {
      agents,
    });

    expect(result.intent).toBe("email-draft");
    expect(agents.emailDraftAgent).toHaveBeenCalledWith(
      "CONFIRM EMAIL",
      "user-1",
    );
  });

  it("runs search and market agents for mixed intent", async () => {
    const agents = createAgents();
    const result = await orchestrate(
      "Find affordable homes in Pasadena and tell me whether prices are rising.",
      "user-1",
      { agents },
    );

    expect(result.intent).toBe("mixed");
    expect(result.parts.map((part) => part.intent)).toEqual(["search", "market"]);
    expect(result.message).toContain("Property matches:");
    expect(result.message).toContain("Market summary:");
    expect(agents.propertySearchAgent).toHaveBeenCalled();
    expect(agents.marketStatsAgent).toHaveBeenCalled();
  });

  it("returns a friendly message when an agent throws", async () => {
    const agents = createAgents();
    vi.mocked(agents.propertySearchAgent).mockRejectedValueOnce(
      new Error("database offline"),
    );

    const result = await orchestrate("Find homes in Irvine", "user-1", {
      agents,
    });

    expect(result.intent).toBe("search");
    expect(result.message).toContain("Check that MySQL is running");
  });

  it("returns fallback text for unsupported questions", async () => {
    const agents = createAgents();
    const result = await orchestrate("hello there", "user-1", { agents });

    expect(result.intent).toBe("fallback");
    expect(result.parts).toEqual([]);
    expect(agents.propertySearchAgent).not.toHaveBeenCalled();
    expect(result.message).toContain("Try asking about properties");
  });
});
