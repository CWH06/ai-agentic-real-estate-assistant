import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingRow } from "../src/db/listingSearch";

const searchActiveListingsMock = vi.hoisted(() => vi.fn());

vi.mock("../src/db/listingSearch", () => ({
  searchActiveListings: searchActiveListingsMock,
}));

import { handlePropertySearch } from "../src/skills/property-search/conversation";
import { clearSession, getSession } from "../src/skills/property-search/session";

function listing(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    L_ListingID: "mock-listing-1",
    L_DisplayId: "OC-1001",
    L_Address: "15 Demo Street",
    L_City: "Irvine",
    L_Zip: "92618",
    price: 1850000,
    beds: 4,
    baths: 3,
    sqft: 2400,
    type: "SingleFamilyResidence",
    status: "Active",
    lat: null,
    lng: null,
    YearBuilt: 2019,
    AssociationFee: 350,
    DaysOnMarket: 12,
    PoolPrivateYN: "True",
    ViewYN: "True",
    FireplaceYN: null,
    PhotoCount: 25,
    LA1_UserFirstName: "Demo",
    LA1_UserLastName: "Agent",
    LO1_OrganizationName: "Demo Realty",
    ...overrides,
  };
}

async function say(userId: string, text: string) {
  const reply = await handlePropertySearch(userId, text);
  console.log(`User: ${text}`);
  console.log(`Agent: ${reply.message}`);
  console.log("---");
  return reply;
}

describe("property conversation long local demo", () => {
  beforeEach(() => {
    searchActiveListingsMock.mockReset();
    searchActiveListingsMock.mockResolvedValue([
      listing(),
      listing({
        L_ListingID: "mock-listing-2",
        L_DisplayId: "OC-1002",
        L_Address: "28 Sample Lane",
        price: 1925000,
        beds: 4,
        baths: 3.5,
        sqft: 2600,
        PhotoCount: 31,
      }),
    ]);
  });

  it("shows which filters are required before search and which optional filters can be added later", async () => {
    const requiredUserId = "required-filter-demo-user";
    clearSession(requiredUserId);

    console.log("Required filter flow: city, budget, type, and bedrooms must exist before search.");
    console.log("---");

    const first = await say(requiredUserId, "I want to buy something nice");
    expect(first).toEqual({
      message: "Which city are you looking in?",
      done: false,
    });
    expect(searchActiveListingsMock).not.toHaveBeenCalled();

    const second = await say(requiredUserId, "in Irvine");
    expect(second).toEqual({
      message: "What is your budget?",
      done: false,
    });
    expect(getSession(requiredUserId).filters).toMatchObject({
      city: "Irvine",
      maxPrice: null,
      type: null,
      beds: null,
    });
    expect(searchActiveListingsMock).not.toHaveBeenCalled();

    const third = await say(requiredUserId, "under 2000000");
    expect(third).toEqual({
      message: "Do you prefer a condo, townhome, or single family home?",
      done: false,
    });
    expect(getSession(requiredUserId).filters).toMatchObject({
      city: "Irvine",
      maxPrice: 2000000,
      type: null,
      beds: null,
    });
    expect(searchActiveListingsMock).not.toHaveBeenCalled();

    const fourth = await say(requiredUserId, "single family home");
    expect(fourth).toEqual({
      message: "How many bedrooms do you need?",
      done: false,
    });
    expect(getSession(requiredUserId).filters).toMatchObject({
      city: "Irvine",
      maxPrice: 2000000,
      type: "SingleFamilyResidence",
      beds: null,
    });
    expect(searchActiveListingsMock).not.toHaveBeenCalled();

    const fifth = await say(requiredUserId, "4 bedrooms");
    expect(fifth.done).toBe(true);
    expect(fifth.message).toContain("I found 2 matching listings");
    expect(searchActiveListingsMock).toHaveBeenCalledTimes(1);
    expect(searchActiveListingsMock).toHaveBeenLastCalledWith(
      {
        city: "Irvine",
        maxPrice: 2000000,
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

    const optionalUserId = "optional-filter-demo-user";
    clearSession(optionalUserId);

    console.log("Optional filter flow: baths, sqft, pool, view, and HOA refine search but do not block results.");
    console.log("---");

    const readySearch = await say(
      optionalUserId,
      "Find a condo in Irvine under 2200000 with 2 bedrooms",
    );
    expect(readySearch.done).toBe(true);
    expect(readySearch.message).toContain("I found 2 matching listings");
    expect(searchActiveListingsMock).toHaveBeenCalledTimes(2);
    expect(searchActiveListingsMock).toHaveBeenLastCalledWith(
      {
        city: "Irvine",
        maxPrice: 2200000,
        beds: 2,
        baths: null,
        sqft: null,
        type: "Condominium",
        pool: null,
        hasView: null,
        maxHoa: null,
      },
      1,
      5,
    );

    const refinedSearch = await say(
      optionalUserId,
      "add 2 baths, at least 1200 sqft, pool, view, hoa below 400",
    );
    expect(refinedSearch.done).toBe(true);
    expect(refinedSearch.message).toContain("I found 2 matching listings");
    expect(searchActiveListingsMock).toHaveBeenCalledTimes(3);
    expect(searchActiveListingsMock).toHaveBeenLastCalledWith(
      {
        city: "Irvine",
        maxPrice: 2200000,
        beds: 2,
        baths: 2,
        sqft: 1200,
        type: "Condominium",
        pool: "True",
        hasView: "True",
        maxHoa: 400,
      },
      1,
      5,
    );

    const session = getSession(optionalUserId);
    expect(session.lastResults).toHaveLength(2);
    expect(session.filters).toMatchObject({
      city: "Irvine",
      maxPrice: 2200000,
      beds: 2,
      baths: 2,
      sqft: 1200,
      type: "Condominium",
      pool: "True",
      hasView: "True",
      maxHoa: 400,
    });
  });
});
