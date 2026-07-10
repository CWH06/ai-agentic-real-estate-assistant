import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "../src/db/mysql";
import { getSoldComps } from "../src/db/soldComps";
import { propertySearchSkill } from "../src/skills/property-search";

const runDbTests = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!runDbTests)("database integration", () => {
  afterAll(async () => {
    await closePool();
  });
  it("searches active listings from rets_property", async () => {
    const result = await propertySearchSkill("homes in Irvine under 2000000", {
      limit: 3,
    });

    expect(result.filters).toMatchObject({
      city: "Irvine",
      maxPrice: 2000000,
      type: "SingleFamilyResidence",
    });
    expect(result.listings.length).toBeGreaterThan(0);
    expect(result.listings.length).toBeLessThanOrEqual(3);
    expect(result.listings[0]).toHaveProperty("summary");

  });

  it("searches sold comps from california_sold", async () => {
    const comps = await getSoldComps("Irvine", 12);

    expect(comps.length).toBeGreaterThan(0);
    expect(comps.length).toBeLessThanOrEqual(50);
    expect(comps[0]).toHaveProperty("ClosePrice");
    expect(comps[0]).toHaveProperty("PropertySubType");

  });
});
