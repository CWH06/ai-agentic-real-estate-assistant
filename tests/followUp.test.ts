import { describe, expect, it } from "vitest";
import { getFollowUpQuestion } from "../src/skills/property-search/followUp";
import type { PropertyFilters } from "../src/types/propertyFilters";

const baseFilters: PropertyFilters = {
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

describe("getFollowUpQuestion", () => {
  it("asks for city first", () => {
    expect(getFollowUpQuestion(baseFilters)).toBe("Which city are you looking in?");
  });

  it("asks for budget after city is known", () => {
    expect(getFollowUpQuestion({ ...baseFilters, city: "Irvine" })).toBe("What is your budget?");
  });

  it("asks for property type after city and budget are known", () => {
    expect(getFollowUpQuestion({
      ...baseFilters,
      city: "Irvine",
      maxPrice: 1200000,
    })).toBe("Do you prefer a condo, townhome, or single family home?");
  });

  it("asks for bedrooms before searching", () => {
    expect(getFollowUpQuestion({
      ...baseFilters,
      city: "Irvine",
      maxPrice: 1200000,
      type: "SingleFamilyResidence",
    })).toBe("How many bedrooms do you need?");
  });

  it("returns null when enough filters are present", () => {
    expect(getFollowUpQuestion({
      ...baseFilters,
      city: "Irvine",
      maxPrice: 1200000,
      type: "SingleFamilyResidence",
      beds: 3,
    })).toBeNull();
  });
});
