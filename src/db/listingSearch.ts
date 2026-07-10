import type { PropertyFilters } from "../types/propertyFilters";
import { query } from "./mysql";

export interface ListingRow {
  L_ListingID: string | null;
  L_DisplayId: string | null;
  L_Address: string | null;
  L_City: string | null;
  L_Zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  type: string | null;
  status: string | null;
  lat: string | null;
  lng: string | null;
  YearBuilt: number | null;
  AssociationFee: number | null;
  DaysOnMarket: number | null;
  PoolPrivateYN: string | null;
  ViewYN: string | null;
  FireplaceYN: string | null;
  PhotoCount: number | null;
  LA1_UserFirstName: string | null;
  LA1_UserLastName: string | null;
  LO1_OrganizationName: string | null;
}

export interface ActiveListingQuery {
  sql: string;
  params: unknown[];
}

export function buildActiveListingQuery(
  filters: PropertyFilters,
  page = 1,
  limit = 10,
): ActiveListingQuery {
  const requestedPage = page ?? 1;
  const requestedLimit = limit ?? 10;
  const safePage = Math.max(1, Math.floor(requestedPage));
  const safeLimit = Math.min(50, Math.max(1, Math.floor(requestedLimit)));
  const offset = (safePage - 1) * safeLimit;

  const where = ["L_Status = ?"];
  const params: unknown[] = ["Active"];

  if (filters.city) {
    where.push("L_City = ?");
    params.push(filters.city);
  }
  if (filters.maxPrice) {
    where.push("L_SystemPrice <= ?");
    params.push(filters.maxPrice);
  }
  if (filters.beds) {
    where.push("L_Keyword2 >= ?");
    params.push(filters.beds);
  }
  if (filters.baths) {
    where.push("LM_Dec_3 >= ?");
    params.push(filters.baths);
  }
  if (filters.sqft) {
    where.push("LM_Int2_3 >= ?");
    params.push(filters.sqft);
  }
  if (filters.type) {
    where.push("L_Type_ = ?");
    params.push(filters.type);
  }
  if (filters.pool) {
    where.push("PoolPrivateYN = ?");
    params.push(filters.pool);
  }
  if (filters.hasView) {
    where.push("ViewYN = ?");
    params.push(filters.hasView);
  }
  if (filters.maxHoa) {
    where.push("AssociationFee <= ?");
    params.push(filters.maxHoa);
  }

  const sql = `
    SELECT
      L_ListingID,
      L_DisplayId,
      L_Address,
      L_City,
      L_Zip,
      L_SystemPrice AS price,
      L_Keyword2 AS beds,
      LM_Dec_3 AS baths,
      LM_Int2_3 AS sqft,
      L_Type_ AS type,
      L_Status AS status,
      LMD_MP_Latitude AS lat,
      LMD_MP_Longitude AS lng,
      YearBuilt,
      AssociationFee,
      DaysOnMarket,
      PoolPrivateYN,
      ViewYN,
      FireplaceYN,
      PhotoCount,
      LA1_UserFirstName,
      LA1_UserLastName,
      LO1_OrganizationName
    FROM rets_property
    WHERE ${where.join(" AND ")}
    ORDER BY L_SystemPrice ASC
    LIMIT ? OFFSET ?
  `.trim();

  params.push(safeLimit, offset);
  return { sql, params };
}

export async function searchActiveListings(
  filters: PropertyFilters,
  page = 1,
  limit = 10,
): Promise<ListingRow[]> {
  const { sql, params } = buildActiveListingQuery(filters, page, limit);
  return query<ListingRow>(sql, params);
}
