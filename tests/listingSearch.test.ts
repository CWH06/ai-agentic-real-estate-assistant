import { describe, expect, it } from "vitest";
import { buildActiveListingQuery } from "../src/db/listingSearch";
import { buildSoldCompsQuery } from "../src/db/soldComps";
import type { PropertyFilters } from "../src/types/propertyFilters";

const emptyFilters: PropertyFilters = {
  city: null,
  maxPrice: null,
  beds: null,
  baths: null,
  sqft: null,
  type: null,
  pool: null,
  hasView: null,
  maxHoa: null,
};

describe("buildActiveListingQuery", () => {
  it("uses parameterized filters for active listing search", () => {
    const { sql, params } = buildActiveListingQuery({
      ...emptyFilters,
      city: "Irvine",
      maxPrice: 1500000,
      beds: 3,
      baths: 2,
      sqft: 1800,
      type: "Condominium",
      pool: "True",
      hasView: "True",
      maxHoa: 500,
    }, 2, 5);

    expect(sql).toContain("FROM rets_property");
    expect(sql).toContain("L_City = ?");
    expect(sql).toContain("L_SystemPrice <= ?");
    expect(sql).toContain("AssociationFee <= ?");
    expect(sql).not.toContain("Irvine");
    expect(params).toEqual([
      "Active",
      "Irvine",
      1500000,
      3,
      2,
      1800,
      "Condominium",
      "True",
      "True",
      500,
      5,
      5,
    ]);
  });

  it("clamps pagination limit", () => {
    const { params } = buildActiveListingQuery(emptyFilters, 1, 500);
    expect(params).toEqual(["Active", 50, 0]);
  });
});

describe("buildSoldCompsQuery", () => {
  it("builds a parameterized sold comps query", () => {
    const { sql, params } = buildSoldCompsQuery("Pasadena", 12);
    expect(sql).toContain("FROM california_sold");
    expect(sql).toContain("City = ?");
    expect(sql).not.toContain("Pasadena");
    expect(params).toEqual(["Pasadena", 12]);
  });
});
