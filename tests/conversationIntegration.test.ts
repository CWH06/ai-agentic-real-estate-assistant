import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "../src/db/mysql";
import { handlePropertySearch } from "../src/skills/property-search/conversation";
import { clearSession, getSession } from "../src/skills/property-search/session";

const runDbTests = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!runDbTests)("property conversation integration", () => {
  afterAll(async () => {
    await closePool();
  });

  it("collects filters across turns and returns listings", async () => {
    const userId = "conversation-search-test";
    clearSession(userId);

    const first = await handlePropertySearch(userId, "Find homes in Irvine");
    expect(first).toEqual({
      message: "What is your budget?",
      done: false,
    });

    const second = await handlePropertySearch(userId, "under 2000000");
    expect(second).toEqual({
      message: "How many bedrooms do you need?",
      done: false,
    });

    const third = await handlePropertySearch(userId, "3 bedrooms");
    expect(third.done).toBe(true);
    expect(third.message).toContain("I found");
    expect(third.message).toContain("Irvine");

    const session = getSession(userId);
    expect(session.filters).toMatchObject({
      city: "Irvine",
      maxPrice: 2000000,
      beds: 3,
      type: "SingleFamilyResidence",
    });
    expect(session.lastResults.length).toBeGreaterThan(0);
  });

  it("can reset the conversation", async () => {
    const userId = "conversation-reset-test";

    const reset = await handlePropertySearch(userId, "reset");

    expect(reset).toEqual({
      message: "Okay, I cleared your search. What city are you looking in?",
      done: false,
    });
    expect(getSession(userId).conversationStep).toBe(0);
  });
});
