# california_sold Exact Column Reference

Document ID: `california-sold-schema`

Last verified from MySQL: 2026-08-14

Purpose: Answer questions about the exact columns currently present in the project's `rets.california_sold` table. This reference was generated from the read-only SQL command `DESCRIBE california_sold`.

## california_sold columns, part 1 of 2

The first 23 `california_sold` columns are: `ListingKey`, `ViewYN`, `WaterfrontYN`, `BasementYN`, `PoolPrivateYN`, `OriginalListPrice`, `CloseDate`, `ClosePrice`, `ListAgentFirstName`, `ListAgentLastName`, `Latitude`, `Longitude`, `UnparsedAddress`, `PropertyType`, `LivingArea`, `ListPrice`, `DaysOnMarket`, `ListOfficeName`, `BuyerOfficeName`, `ListAgentFullName`, `BuyerAgentFirstName`, `BuyerAgentLastName`, and `AttachedGarageYN`.

## california_sold columns, part 2 of 2

The remaining 23 `california_sold` columns are: `ParkingTotal`, `PropertySubType`, `LotSizeAcres`, `SubdivisionName`, `YearBuilt`, `BathroomsTotalInteger`, `City`, `BedroomsTotal`, `PurchaseContractDate`, `ListingContractDate`, `StateOrProvince`, `MiddleOrJuniorSchool`, `FireplaceYN`, `Stories`, `HighSchool`, `Levels`, `MainLevelBedrooms`, `NewConstructionYN`, `GarageSpaces`, `HighSchoolDistrict`, `PostalCode`, `AssociationFee`, and `LotSizeSquareFeet`.

## california_sold price, date, and market fields

The main `california_sold` market-analysis columns are `OriginalListPrice` (double), `ListPrice` (double), `ClosePrice` (double), `CloseDate` (varchar), `DaysOnMarket` (bigint), `ListingContractDate` (varchar), and `PurchaseContractDate` (varchar). Date values are currently imported as strings, so SQL calculations should parse or validate their format before relying on date comparisons.

## california_sold property and location fields

The main `california_sold` property and location columns include `PropertyType`, `PropertySubType`, `LivingArea`, `LotSizeAcres`, `LotSizeSquareFeet`, `BedroomsTotal`, `BathroomsTotalInteger`, `YearBuilt`, `Stories`, `Levels`, `City`, `StateOrProvince`, `PostalCode`, `Latitude`, `Longitude`, `UnparsedAddress`, `SubdivisionName`, `HighSchool`, `MiddleOrJuniorSchool`, and `HighSchoolDistrict`.

## california_sold feature and representation fields

Feature columns in `california_sold` include `ViewYN`, `WaterfrontYN`, `BasementYN`, `PoolPrivateYN`, `AttachedGarageYN`, `FireplaceYN`, `NewConstructionYN`, `ParkingTotal`, `GarageSpaces`, and `AssociationFee`. Representation columns include the listing and buyer agent name fields plus `ListOfficeName` and `BuyerOfficeName`.

## Schema verification rule

This document records the schema observed on 2026-08-14. If the SQL dump or migration changes, run `DESCRIBE california_sold` again and update this reference before re-indexing the knowledge base.
