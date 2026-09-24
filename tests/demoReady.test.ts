import { afterEach, describe, expect, it, vi } from "vitest";
import { createSampleAgents, DEMO_QUERIES } from "../src/demo/sampleAgents";
import { orchestrate } from "../src/orchestrator";
import { clearSession } from "../src/skills/property-search/session";

// A sample demo must remain safe even when real credentials are present locally.
vi.mock("../src/db/mysql", () => ({ query: vi.fn(() => { throw new Error("Unexpected SQL in sample mode"); }) }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => { throw new Error("Unexpected SMTP in sample mode"); }) } }));

afterEach(() => { clearSession("sample-e2e"); vi.unstubAllGlobals(); });

describe("demo-ready conversation", () => {
  it("does not consume unrelated questions as unfinished search follow-ups", async () => {
    const { agents } = await createSampleAgents();
    await orchestrate("Find homes in Irvine", "sample-e2e", { agents });
    const unrelated = await orchestrate("Can you book me a flight?", "sample-e2e", { agents });
    expect(unrelated.intent).toBe("fallback");
    const followUp = await orchestrate("under $2m", "sample-e2e", { agents });
    expect(followUp.intent).toBe("search");
    expect(followUp.message).toContain("bedrooms");
  });
  it("runs all routes, follow-ups and one-time approval without any network calls", async () => {
    const fetchSpy = vi.fn(() => { throw new Error("Unexpected HTTP in sample mode"); });
    vi.stubGlobal("fetch", fetchSpy);
    const { agents, simulatedDeliveries } = await createSampleAgents();
    const results = [];
    for (const query of DEMO_QUERIES) results.push(await orchestrate(query, "sample-e2e", { agents }));
    expect(results.map((result) => result.intent)).toEqual([
      "help", "search", "search", "search", "search", "market", "semantic",
      "recommend", "knowledge", "mixed", "email-draft", "email-draft", "email-draft", "fallback",
    ]);
    expect(results[4].message).toContain("900001");
    expect(results[5].message).toContain("snapshot ending 2026-08");
    expect(results[6].message).toContain("semantically similar");
    expect(results[7].message).toContain("Top 3");
    expect(results[8].message).toContain("Days on Market");
    expect(results[8].message).toContain("Sources:");
    expect(results[9].message).toContain("Market summary:");
    expect(results[10].message).toContain("not sent");
    expect(results[11].message).toContain("Simulated delivery only");
    expect(results[12].message).toContain("no pending email draft");
    expect(simulatedDeliveries).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not let another user confirm a sample email", async () => {
    const { agents, simulatedDeliveries } = await createSampleAgents();
    await orchestrate("Draft a market report for Irvine to demo@example.com", "sample-e2e", { agents });
    const result = await orchestrate("confirm", "other-user", { agents });
    expect(result.message).toContain("no pending email draft");
    expect(simulatedDeliveries).toHaveLength(0);
  });
});
