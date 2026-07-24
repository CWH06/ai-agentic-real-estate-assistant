import { afterAll, describe, expect, it } from "vitest";
import { onWhatsAppMessage } from "../src/channels/whatsappHandler";
import { closePool } from "../src/db/mysql";
import { clearSession } from "../src/skills/property-search/session";

const runDbTests = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!runDbTests)("WhatsApp message adapter", () => {
  afterAll(async () => {
    await closePool();
  });

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
});
