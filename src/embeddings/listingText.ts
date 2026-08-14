import { normalizeEmbeddingInput } from "./openaiEmbeddings";

export interface ListingEmbeddingTextRow {
  L_ListingID: string | null;
  L_DisplayId?: string | null;
  L_Address: string | null;
  L_City: string | null;
  L_Zip?: string | null;
  L_Type_: string | null;
  L_Keyword2: number | null;
  LM_Dec_3: number | string | null;
  LM_Int2_3: number | null;
  L_SystemPrice: number | null;
  YearBuilt: number | null;
  L_Remarks: string | null;
  SubdivisionName?: string | null;
  ArchitecturalStyle?: string | null;
  View?: string | null;
  PoolPrivateYN?: string | null;
  ViewYN?: string | null;
  FireplaceYN?: string | null;
}

function formatMoney(value: number | null): string | null {
  return value ? `$${value.toLocaleString()}` : null;
}

function formatBooleanFeature(label: string, value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return label;
  }
  return null;
}

export function buildListingEmbeddingText(row: ListingEmbeddingTextRow): string {
  const facts = [
    row.L_Type_ ? `${row.L_Type_} property` : "Property",
    row.L_City ? `in ${row.L_City}, CA` : null,
    row.L_Address ? `at ${row.L_Address}` : null,
    row.L_Zip ? `ZIP ${row.L_Zip}` : null,
    row.L_Keyword2 ? `${row.L_Keyword2} beds` : null,
    row.LM_Dec_3 ? `${row.LM_Dec_3} baths` : null,
    row.LM_Int2_3 ? `${row.LM_Int2_3.toLocaleString()} sqft` : null,
    row.YearBuilt ? `built in ${row.YearBuilt}` : null,
    formatMoney(row.L_SystemPrice),
  ].filter(Boolean);

  const descriptors = [
    row.SubdivisionName ? `Subdivision: ${row.SubdivisionName}` : null,
    row.ArchitecturalStyle ? `Style: ${row.ArchitecturalStyle}` : null,
    row.View ? `View: ${row.View}` : null,
    formatBooleanFeature("private pool", row.PoolPrivateYN),
    formatBooleanFeature("notable view", row.ViewYN),
    formatBooleanFeature("fireplace", row.FireplaceYN),
  ].filter(Boolean);

  return normalizeEmbeddingInput(
    [
      facts.join(". "),
      descriptors.join(". "),
      row.L_Remarks ?? "",
    ]
      .filter(Boolean)
      .join(". "),
  );
}
