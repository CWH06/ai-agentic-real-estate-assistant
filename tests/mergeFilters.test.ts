import { describe, expect, it } from "vitest";
import { mergeFilters } from "../src/skills/property-search/mergeFilters";
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

describe("mergeFilters", () => {
  it("keeps old values when new values are null", () => {
    const current: PropertyFilters = {
      ...emptyFilters,
      city: "Irvine",
      type: "SingleFamilyResidence",
    };

    const updates: PropertyFilters = {
      ...emptyFilters,
      maxPrice: 1200000,
    };

    expect(mergeFilters(current, updates)).toEqual({
      ...emptyFilters,
      city: "Irvine",
      type: "SingleFamilyResidence",
      maxPrice: 1200000,
    });
  });

  it("overwrites old values when new values exist", () => {
    const current: PropertyFilters = {
      ...emptyFilters,
      city: "Irvine",
      maxPrice: 1500000,
    };

    const updates: PropertyFilters = {
      ...emptyFilters,
      city: "Pasadena",
      maxPrice: 1000000,
    };

    expect(mergeFilters(current, updates)).toEqual({
      ...emptyFilters,
      city: "Pasadena",
      maxPrice: 1000000,
    });
  });
});