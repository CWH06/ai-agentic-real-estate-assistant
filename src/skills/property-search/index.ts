import { formatPropertyCards } from "./formatListings";
import { searchActiveListings } from "../../db/listingSearch";
import { parsePropertyQuery } from "./parsePropertyQuery";

export interface PropertySearchOptions {
  page?: number;
  limit?: number;
  includeResults?: boolean;
}

export async function propertySearchSkill(query: string, options: PropertySearchOptions = {}) {
  const filters = parsePropertyQuery(query);

  if (options.includeResults === false) {
    return { filters, listings: [] };
  }

  const rows = await searchActiveListings(filters, options.page, options.limit);
  return {
    filters,
    listings: formatPropertyCards(rows),
  };
}

export { parsePropertyQuery };
