import type { PropertyFilters } from "../../types/propertyFilters";

export function getFollowUpQuestion(filters: PropertyFilters): string | null {
  if (!filters.city) {
    return "Which city are you looking in?";
  }

  if (!filters.maxPrice) {
    return "What is your budget?";
  }

  if (!filters.type) {
    return "Do you prefer a condo, townhome, or single family home?";
  }

  if (!filters.beds) {
    return "How many bedrooms do you need?";
  }

  return null;
}
