import { query } from "./mysql";

export interface SoldCompRow {
  ListingKey: number | null;
  UnparsedAddress: string | null;
  City: string | null;
  CloseDate: string | null;
  ClosePrice: number | null;
  OriginalListPrice: number | null;
  ListPrice: number | null;
  DaysOnMarket: number | null;
  BedroomsTotal: number | null;
  BathroomsTotalInteger: number | null;
  LivingArea: number | null;
  PropertyType: string | null;
  PropertySubType: string | null;
  YearBuilt: number | null;
  ListAgentFullName: string | null;
  ListOfficeName: string | null;
  BuyerOfficeName: string | null;
}

export interface SoldCompsQuery {
  sql: string;
  params: unknown[];
}

export function buildSoldCompsQuery(city: string, months = 12): SoldCompsQuery {
  const safeMonths = Math.min(60, Math.max(1, Math.floor(months)));
  const sql = `
    SELECT
      ListingKey,
      UnparsedAddress,
      City,
      CloseDate,
      ClosePrice,
      OriginalListPrice,
      ListPrice,
      DaysOnMarket,
      BedroomsTotal,
      BathroomsTotalInteger,
      LivingArea,
      PropertyType,
      PropertySubType,
      YearBuilt,
      ListAgentFullName,
      ListOfficeName,
      BuyerOfficeName
    FROM california_sold
    WHERE City = ?
      AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      AND PropertyType = "Residential"
    ORDER BY CloseDate DESC
    LIMIT 50
  `.trim();

  return { sql, params: [city, safeMonths] };
}

export async function getSoldComps(city: string, months = 12): Promise<SoldCompRow[]> {
  const { sql, params } = buildSoldCompsQuery(city, months);
  return query<SoldCompRow>(sql, params);
}
