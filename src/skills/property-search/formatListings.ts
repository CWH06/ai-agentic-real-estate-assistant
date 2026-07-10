import type { ListingRow } from "../../db/listingSearch";

export interface PropertyCard {
  listingId: string | null;
  displayId: string | null;
  address: string;
  city: string | null;
  zip: string | null;
  price: number | null;
  summary: string;
  facts: {
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    type: string | null;
    status: string | null;
    yearBuilt: number | null;
    hoa: number | null;
    daysOnMarket: number | null;
    photoCount: number | null;
  };
  features: {
    pool: string | null;
    view: string | null;
    fireplace: string | null;
  };
  agent: {
    name: string | null;
    office: string | null;
  };
}

export function formatPropertyCards(rows: ListingRow[]): PropertyCard[] {
  return rows.map((row) => {
    const agentName = [row.LA1_UserFirstName, row.LA1_UserLastName]
      .filter(Boolean)
      .join(" ") || null;

    return {
      listingId: row.L_ListingID,
      displayId: row.L_DisplayId,
      address: row.L_Address ?? "Address unavailable",
      city: row.L_City,
      zip: row.L_Zip,
      price: row.price,
      summary: formatSummary(row),
      facts: {
        beds: row.beds,
        baths: row.baths,
        sqft: row.sqft,
        type: row.type,
        status: row.status,
        yearBuilt: row.YearBuilt,
        hoa: row.AssociationFee,
        daysOnMarket: row.DaysOnMarket,
        photoCount: row.PhotoCount,
      },
      features: {
        pool: row.PoolPrivateYN,
        view: row.ViewYN,
        fireplace: row.FireplaceYN,
      },
      agent: {
        name: agentName,
        office: row.LO1_OrganizationName,
      },
    };
  });
}

function formatSummary(row: ListingRow): string {
  const price = row.price ? `$${row.price.toLocaleString()}` : "Price unavailable";
  const beds = row.beds ?? "?";
  const baths = row.baths ?? "?";
  const sqft = row.sqft ? `${row.sqft.toLocaleString()} sqft` : "sqft unavailable";
  return `${price} | ${beds}bd/${baths}ba | ${sqft}`;
}
