import { describe, expect, it } from "vitest";
import { parsePropertyQuery } from "../src/skills/property-search/parsePropertyQuery";

describe("parsePropertyQuery", () => {
  it("parses the handbook example", () => {
    expect(parsePropertyQuery("Show me 3-bedroom condos in Irvine under $1.5M with a pool.")).toMatchObject({
      city: "Irvine",
      maxPrice: 1500000,
      beds: 3,
      type: "Condominium",
      pool: "True",
    });
  });

  it("parses single family homes with baths and view", () => {
    expect(parsePropertyQuery("single family homes in Pasadena under 1200000 with 2.5 baths and mountain view")).toMatchObject({
      city: "Pasadena",
      maxPrice: 1200000,
      baths: 2.5,
      type: "SingleFamilyResidence",
      hasView: "True",
    });
  });

  it("parses k prices", () => {
    expect(parsePropertyQuery("townhomes in San Diego below 900k with 3 beds")).toMatchObject({
      city: "San Diego",
      maxPrice: 900000,
      beds: 3,
      type: "Townhouse",
    });
  });

  it("parses square footage", () => {
    expect(parsePropertyQuery("homes in Newport Beach under 2.2m at least 1800 sq ft")).toMatchObject({
      city: "Newport Beach",
      maxPrice: 2200000,
      sqft: 1800,
      type: "SingleFamilyResidence",
    });
  });

  it("parses HOA limit", () => {
    expect(parsePropertyQuery("condo in Santa Monica under 1m hoa under 500")).toMatchObject({
      city: "Santa Monica",
      maxPrice: 1000000,
      maxHoa: 500,
      type: "Condominium",
    });
  });

  it("parses land search", () => {
    expect(parsePropertyQuery("land near Malibu below $750k")).toMatchObject({
      city: "Malibu",
      maxPrice: 750000,
      type: "UnimprovedLand",
    });
  });

  it("parses duplex search", () => {
    expect(parsePropertyQuery("duplex in Oakland under 1,100,000")).toMatchObject({
      city: "Oakland",
      maxPrice: 1100000,
      type: "Duplex",
    });
  });

  it("parses abbreviated beds and baths", () => {
    expect(parsePropertyQuery("2 bd 2 ba condo in Long Beach under 650k")).toMatchObject({
      city: "Long Beach",
      maxPrice: 650000,
      beds: 2,
      baths: 2,
      type: "Condominium",
    });
  });

  it("parses pool and view without price", () => {
    expect(parsePropertyQuery("4 bedroom house in Anaheim with pool and city views")).toMatchObject({
      city: "Anaheim",
      beds: 4,
      type: "SingleFamilyResidence",
      pool: "True",
      hasView: "True",
    });
  });

  it("returns nulls for missing filters", () => {
    expect(parsePropertyQuery("show me something nice")).toEqual({
      city: null,
      maxPrice: null,
      beds: null,
      baths: null,
      sqft: null,
      type: null,
      pool: null,
      hasView: null,
      maxHoa: null,
    });
  });

  it("parses manufactured homes", () => {
    expect(parsePropertyQuery("mobile home in Riverside under 350k with 2 bedrooms")).toMatchObject({
      city: "Riverside",
      maxPrice: 350000,
      beds: 2,
      type: "ManufacturedHome",
    });
  });
});
