import { afterAll, describe, expect, it } from "vitest";
import { onWhatsAppMessage } from "../src/channels/whatsappHandler";
import { closePool } from "../src/db/mysql";
import { clearSession } from "../src/skills/property-search/session";

const runDbTests = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!runDbTests)("WhatsApp message adapter", () => {
  afterAll(async () => {
    await closePool();
  }, 30_000);

  it("turns WhatsApp-style messages into a multi-turn property search", async () => {
    const userId = "whatsapp-demo-user";
    clearSession(userId);

    const first = await onWhatsAppMessage({
      userId,
      text: "Find homes in Irvine",
    });
    expect(first).toEqual({
      userId,
      text: "What is your budget?",
    });

    const second = await onWhatsAppMessage({
      userId,
      text: "under 2000000",
    });
    expect(second).toEqual({
      userId,
      text: "How many bedrooms do you need?",
    });

    const third = await onWhatsAppMessage({
      userId,
      text: "3 bedrooms",
    });
    expect(third.userId).toBe(userId);
    expect(third.text).toContain("I found");
    expect(third.text).toContain("Irvine");
  });

  it("routes WhatsApp-style market and semantic requests", async () => {
    const userId = "whatsapp-router-user";

    const market = await onWhatsAppMessage({
      userId,
      text: "market stats for Irvine over 12 months",
    });

    expect(market.userId).toBe(userId);
    expect(market.text).toContain("Market report: Irvine");

    const semantic = await onWhatsAppMessage({
      userId,
      text: "semantic search: charming craftsman with mountain views",
    });

    expect(semantic.userId).toBe(userId);
    expect(semantic.text).toContain("semantically similar listings");
  }, 30_000);
});
