import { describe, expect, it } from "vitest";
import { clearSession, getSession, updateSession } from "../src/skills/property-search/session";

describe("property search session", () => {
  it("creates a default session", () => {
    const userId = "session-default-test";
    clearSession(userId);

    const session = getSession(userId);

    expect(session.conversationStep).toBe(0);
    expect(session.lastResults).toEqual([]);
    expect(session.filters.city).toBeNull();
  });

  it("updates and clears a session", () => {
    const userId = "session-update-test";
    clearSession(userId);

    updateSession(userId, {
      conversationStep: 2,
      filters: {
        ...getSession(userId).filters,
        city: "Irvine",
        maxPrice: 1200000,
      },
    });

    expect(getSession(userId).conversationStep).toBe(2);
    expect(getSession(userId).filters.city).toBe("Irvine");
    expect(getSession(userId).filters.maxPrice).toBe(1200000);

    clearSession(userId);
    expect(getSession(userId).conversationStep).toBe(0);
    expect(getSession(userId).filters.city).toBeNull();
  });
});
