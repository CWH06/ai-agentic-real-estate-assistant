# Project MLS Field Guide

Document ID: `mls-fields`

Last reviewed: 2026-08-14

Purpose: Explain the two MLS-derived tables used by this project and the fields the assistant is allowed to describe. Field meanings are based on the project handbook and the imported database schema.

Scope note: MLS feeds vary by provider. A field being present does not guarantee that every row has a value. The running MySQL schema remains the source of truth for exact column names and types.

## `rets_property`: Active and Current Listings

`rets_property` is the project's current-listing table. Property search, active inventory, semantic search, and listing recommendations read from this table. Queries normally require `L_Status = "Active"` when the user wants properties that are currently marketed as available.

Important identifier and status fields:

- `L_ListingID`: internal listing identifier used by the project and embedding index.
- `L_DisplayId`: public-facing MLS number when supplied by the feed.
- `L_Status`: listing status used by the project, including the value `Active`.
- `StandardStatus`: standardized status when provided.
- `ModificationTimestamp`: latest recorded modification time.

Important location fields:

- `L_Address`: display address.
- `L_City`: city.
- `L_Zip`: ZIP or postal code.
- `LMD_MP_Latitude` and `LMD_MP_Longitude`: map coordinates.
- `DistrictName`: unified school district added by the school-district spatial join.
- `SubdivisionName`: subdivision or neighborhood name when supplied.

Important price and physical-characteristic fields:

- `L_SystemPrice`: current system/list price used by the project.
- `L_Type_`: property type.
- `L_Keyword2`: bedroom count in this feed.
- `LM_Dec_3`: bathroom count in this feed.
- `LM_Int2_3`: living-area square footage in this feed.
- `YearBuilt`: year built.
- `DaysOnMarket`: reported days on market.
- `AssociationFee` and `AssociationFeeFrequency`: HOA amount and frequency when supplied.
- `PoolPrivateYN`, `ViewYN`, and `FireplaceYN`: amenity indicators.
- `ArchitecturalStyle` and `View`: descriptive attributes.
- `L_Remarks`: public listing remarks used to build semantic-search text.
- `PhotoCount`: number of photos reported by the feed.

Important representation fields include `LA1_UserFirstName`, `LA1_UserLastName`, and `LO1_OrganizationName` for the listing agent and office.

## `california_sold`: Closed California Sales

`california_sold` stores historical closed-sale records. The project uses it for market statistics and comparable-sale validation. A sold-data query should state its city and date window and should reject unusable price or area values before calculating metrics.

The main columns described in the project handbook are:

- `ListingKey`: unique record/listing key.
- `ClosePrice`: reported final sale price.
- `CloseDate`: reported closing date.
- `OriginalListPrice`: asking price when first listed.
- `ListPrice`: asking price used for the project's list-to-close calculation.
- `DaysOnMarket`: reported number of days from listing to contract.
- `PropertyType` and `PropertySubType`: broad and detailed property classifications.
- `LivingArea`: reported finished living area.
- `LotSizeSquareFeet` and `LotSizeAcres`: lot size where available.
- `BedroomsTotal`: total bedrooms.
- `BathroomsTotalInteger`, `BathroomsFull`, `BathroomsHalf`, and `BathroomsThreeQuarter`: bathroom counts where available.
- `YearBuilt`: construction year.
- `City`, `StateOrProvince`, and `PostalCode`: locality fields.
- `Latitude` and `Longitude`: geographic coordinates.
- `StreetNumber`, `StreetName`, `StreetSuffix`, `UnitNumber`, and `UnparsedAddress`: address components.
- `ListingContractDate`: listing agreement/start date.
- `PurchaseContractDate`: contract date when supplied.
- `OnMarketDate`: date the listing entered the market.
- `PendingTimestamp`: pending-status timestamp when supplied.
- `CloseDate`: closing date.
- `ListAgentFullName`, `ListAgentMlsId`, and `ListOfficeName`: listing-side representation.
- `BuyerAgentFullName`, `BuyerAgentMlsId`, and `BuyerOfficeName`: buyer-side representation.
- `PoolPrivateYN`, `ViewYN`, `FireplaceYN`, `NewConstructionYN`, and `GarageSpaces`: property features.
- `AssociationYN`, `AssociationFee`, `AssociationFeeFrequency`, and `AssociationName`: association information.
- `SubdivisionName`: subdivision name.
- `HighSchoolDistrict`: reported school district field when provided by the feed.

The imported table may contain additional provider fields. To answer an exact schema question such as “show every current column and SQL type,” inspect MySQL with `DESCRIBE california_sold`; do not invent fields that are absent from the running database.

## Table Selection Rules

Use `rets_property` for active property search, current listing details, current active inventory, listing embeddings, and active-listing recommendations.

Use `california_sold` for closed-sale count, median close price, average close price, sold price per square foot, days on market for sold properties, list-to-close ratio, and recent comparable sales.

Do not combine current list prices from `rets_property` with close prices from unrelated `california_sold` rows to create a ratio. Calculations must use fields from the same valid sold record unless the method explicitly defines a supported join.

## Source Register

1. IDX Exchange, *AI Agentic Engineer Intern Handbook Summer 2026*. Internal project source for the database overview and field descriptions.
2. The project's imported MySQL tables `rets.rets_property` and `rets.california_sold`. Runtime source of truth for exact schema and available values.
