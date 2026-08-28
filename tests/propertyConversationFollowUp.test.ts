import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingRow } from "../src/db/listingSearch";

const searchActiveListingsMock = vi.hoisted(() => vi.fn());

vi.mock("../src/db/listingSearch", () => ({
  searchActiveListings: searchActiveListingsMock,
}));

import { handlePropertySearch } from "../src/skills/property-search/conversation";
import { clearSession, getSession, updateSession } from "../src/skills/property-search/session";

function listing(): ListingRow {
  return {
    L_ListingID: "mock-la-1",
    L_DisplayId: "LA-1",
    L_Address: "100 Demo Street",
    L_City: "Los Angeles",
    L_Zip: "90001",
    price: 1_950_000,
    beds: 4,
    baths: 3,
    sqft: 2200,
    type: "SingleFamilyResidence",
    status: "Active",
    lat: null,
    lng: null,
    YearBuilt: 2001,
    AssociationFee: null,
    DaysOnMarket: 10,
    PoolPrivateYN: null,
    ViewYN: null,
    FireplaceYN: null,
    PhotoCount: 12,
    LA1_UserFirstName: "Demo",
    LA1_UserLastName: "Agent",
    LO1_OrganizationName: "Demo Realty",
  };
}

describe("property conversation contextual follow-ups", () => {
  beforeEach(() => {
    searchActiveListingsMock.mockReset();
    searchActiveListingsMock.mockResolvedValue([listing()]);
  });

  it("accepts a bare compact budget while answering the budget follow-up", async () => {
    const userId = "bare-budget-demo";
    clearSession(userId);

    await expect(handlePropertySearch(userId, "find homes in Los Angeles"))
      .resolves.toEqual({
        message: "What is your budget?",
        done: false,
      });

    await expect(handlePropertySearch(userId, "2M"))
      .resolves.toEqual({
        message: "How many bedrooms do you need?",
        done: false,
      });

    expect(getSession(userId).filters).toMatchObject({
      city: "Los Angeles",
      maxPrice: 2_000_000,
      type: "SingleFamilyResidence",
      beds: null,
    });
  });

  it("treats a bare bedroom number as bedrooms after budget and type are known", async () => {
    const userId = "bare-bedroom-demo";
    clearSession(userId);

    await handlePropertySearch(userId, "find homes in Los Angeles");
    await handlePropertySearch(userId, "2M");
    const result = await handlePropertySearch(userId, "4");

    expect(result.done).toBe(true);
    expect(result.message).toContain("I found 1 matching listings");
    expect(searchActiveListingsMock).toHaveBeenCalledWith(
      {
        city: "Los Angeles",
        maxPrice: 2_000_000,
        beds: 4,
        baths: null,
        sqft: null,
        type: "SingleFamilyResidence",
        pool: null,
        hasView: null,
        maxHoa: null,
      },
      1,
      5,
    );
  });

  it("can update an existing budget with an explicit compact price", async () => {
    const userId = "update-budget-demo";
    clearSession(userId);

    await handlePropertySearch(userId, "find homes in Los Angeles");
    await handlePropertySearch(userId, "200000");
    await expect(handlePropertySearch(userId, "4m"))
      .resolves.toEqual({
        message: "How many bedrooms do you need?",
        done: false,
      });

    expect(getSession(userId).filters).toMatchObject({
      maxPrice: 4_000_000,
      beds: null,
    });
  });

  it("starts a fresh search when a completed session receives a new city search", async () => {
    const userId = "fresh-search-demo";
    clearSession(userId);
    updateSession(userId, {
      conversationStep: 4,
      filters: {
        city: "Pasadena",
        maxPrice: 1_000_000,
        beds: 4,
        baths: null,
        sqft: null,
        type: "SingleFamilyResidence",
        pool: null,
        hasView: null,
        maxHoa: null,
      },
    });

    await expect(
      handlePropertySearch(
        userId,
        "Find me affordable homes in Pasadena and tell me whether prices are rising.",
      ),
    ).resolves.toEqual({
      message: "What is your budget?",
      done: false,
    });

    expect(getSession(userId).filters).toMatchObject({
      city: "Pasadena",
      maxPrice: null,
      beds: null,
      type: "SingleFamilyResidence",
    });
  });
});
