export type PropertyType =
  | "Condominium"
  | "Townhouse"
  | "SingleFamilyResidence"
  | "UnimprovedLand"
  | "Duplex"
  | "Triplex"
  | "ManufacturedHome";

export interface PropertyFilters {
  city: string | null;
  maxPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  type: PropertyType | null;
  pool: "True" | null;
  hasView: "True" | null;
  maxHoa: number | null;
}
