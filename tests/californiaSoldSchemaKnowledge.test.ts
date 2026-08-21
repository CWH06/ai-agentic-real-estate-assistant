import { describe, expect, it } from "vitest";
import { loadKnowledgeDocuments } from "../src/rag/loadKnowledgeDocuments";
import { chunkKnowledgeDocument } from "../src/rag/chunkText";

const EXPECTED_COLUMNS = [
  "ListingKey",
  "ViewYN",
  "WaterfrontYN",
  "BasementYN",
  "PoolPrivateYN",
  "OriginalListPrice",
  "CloseDate",
  "ClosePrice",
  "ListAgentFirstName",
  "ListAgentLastName",
  "Latitude",
  "Longitude",
  "UnparsedAddress",
  "PropertyType",
  "LivingArea",
  "ListPrice",
  "DaysOnMarket",
  "ListOfficeName",
  "BuyerOfficeName",
  "ListAgentFullName",
  "BuyerAgentFirstName",
  "BuyerAgentLastName",
  "AttachedGarageYN",
  "ParkingTotal",
  "PropertySubType",
  "LotSizeAcres",
  "SubdivisionName",
  "YearBuilt",
  "BathroomsTotalInteger",
  "City",
  "BedroomsTotal",
  "PurchaseContractDate",
  "ListingContractDate",
  "StateOrProvince",
  "MiddleOrJuniorSchool",
  "FireplaceYN",
  "Stories",
  "HighSchool",
  "Levels",
  "MainLevelBedrooms",
  "NewConstructionYN",
  "GarageSpaces",
  "HighSchoolDistrict",
  "PostalCode",
  "AssociationFee",
  "LotSizeSquareFeet",
];

describe("california_sold schema knowledge", () => {
  it("contains all 46 columns from the current MySQL schema", async () => {
    const documents = await loadKnowledgeDocuments();
    const schema = documents.find(
      (document) => document.id === "california-sold-schema",
    );

    expect(schema).toBeDefined();
    for (const column of EXPECTED_COLUMNS) {
      expect(schema?.content).toContain(`\`${column}\``);
    }
    expect(EXPECTED_COLUMNS).toHaveLength(46);
  });

  it("keeps the table name attached to both compact column-list chunks", async () => {
    const documents = await loadKnowledgeDocuments();
    const schema = documents.find(
      (document) => document.id === "california-sold-schema",
    );
    if (!schema) throw new Error("Schema knowledge document was not loaded.");

    const columnChunks = chunkKnowledgeDocument(schema)
      .filter((chunk) => chunk.content.includes("columns, part"));

    expect(columnChunks).toHaveLength(2);
    expect(columnChunks.every((chunk) => chunk.content.includes("california_sold"))).toBe(true);
    expect(columnChunks.every((chunk) => chunk.content.length <= 600)).toBe(true);
  });
});
