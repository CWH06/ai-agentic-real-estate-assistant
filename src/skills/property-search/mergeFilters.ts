import type { PropertyFilters } from "../../types/propertyFilters";

export function mergeFilters(
  existingFilters: PropertyFilters,
  newFilters: PropertyFilters,
): PropertyFilters {
  return {
    city: newFilters.city ?? existingFilters.city,
    maxPrice: newFilters.maxPrice ?? existingFilters.maxPrice,
    beds: newFilters.beds ?? existingFilters.beds,
    baths: newFilters.baths ?? existingFilters.baths,
    sqft: newFilters.sqft ?? existingFilters.sqft,
    type: newFilters.type ?? existingFilters.type,
    pool: newFilters.pool ?? existingFilters.pool,
    hasView: newFilters.hasView ?? existingFilters.hasView,
    maxHoa: newFilters.maxHoa ?? existingFilters.maxHoa,
  };
}
