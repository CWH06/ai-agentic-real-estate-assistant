import { describe, expect, it } from "vitest";
import { buildListingEmbeddingText } from "../src/embeddings/listingText";

describe("buildListingEmbeddingText", () => {
  it("combines structured fields and remarks into normalized text", () => {
    const text = buildListingEmbeddingText({
      L_ListingID: "123",
      L_DisplayId: "MLS123",
      L_Address: "12 Canyon Road",
      L_City: "Irvine",
      L_Zip: "92618",
      L_Type_: "SingleFamilyResidence",
      L_Keyword2: 3,
      LM_Dec_3: 2.5,
      LM_Int2_3: 1800,
      L_SystemPrice: 1_250_000,
      YearBuilt: 1998,
      L_Remarks:
        "Charming home with mountain views,\ncharacter, and a bright kitchen.",
      SubdivisionName: "Canyon View",
      ArchitecturalStyle: "Craftsman",
      View: "Mountains",
      PoolPrivateYN: "0",
      ViewYN: "1",
      FireplaceYN: "true",
    });

    expect(text).toContain("SingleFamilyResidence property");
    expect(text).toContain("in Irvine, CA");
    expect(text).toContain("3 beds");
    expect(text).toContain("2.5 baths");
    expect(text).toContain("$1,250,000");
    expect(text).toContain("Style: Craftsman");
    expect(text).toContain("notable view");
    expect(text).toContain("fireplace");
    expect(text).toContain("mountain views, character");
    expect(text).not.toContain("\n");
  });
});
