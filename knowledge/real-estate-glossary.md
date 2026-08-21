# Real Estate Glossary

Document ID: `real-estate-glossary`

Last reviewed: 2026-08-14

Purpose: Provide short, source-grounded definitions for the real estate assistant's RAG knowledge base. Project-specific calculations describe how this repository uses `rets_property` and `california_sold` data.

Scope note: This glossary is educational and explains project terminology. It is not legal, lending, appraisal, tax, or investment advice.

## Active Listing

An active listing is a property currently marketed as available according to its MLS status. In this project, active inventory comes from `rets_property` and is filtered with `L_Status = "Active"`. Because listing status can change, an active result describes the latest imported dataset rather than guaranteeing that the property is still available at the moment a user asks.

Project fields: `rets_property.L_Status`, `rets_property.StandardStatus`, and `rets_property.ModificationTimestamp`.

## Days on Market (DOM)

Days on Market, abbreviated DOM, measures how long a property was marketed before the relevant status or contract event recorded by the MLS. In `california_sold`, the project handbook describes `DaysOnMarket` as the number of days from listing to contract. In `rets_property`, it represents the current listing's reported days on market.

DOM definitions can vary by MLS and may reset after relisting. It should be interpreted with the listing history and source system rather than treated as a universal measure.

Project field: `DaysOnMarket` in both core tables. Standards reference: RESO maps the common MLS abbreviation `DOM` to `DaysOnMarket`.

## Comparable Sales (Comps)

Comparable sales, or comps, are recently sold properties selected because they are relevant to the property being evaluated. Useful similarities may include market area, property subtype, living area, age, condition, lot size, amenities, and sale date. A nearby sale is not automatically a good comparable if it serves a different market segment or has materially different characteristics.

This project retrieves comps from `california_sold` and may filter by city, property type, living-area range, and recency. A comp-based result is a data-supported estimate, not a licensed appraisal.

Project fields include `ClosePrice`, `CloseDate`, `City`, `PropertySubType`, `LivingArea`, `BedroomsTotal`, `BathroomsTotalInteger`, and `YearBuilt`. Authority: Fannie Mae appraisal guidance emphasizes selecting and objectively supporting appropriate comparable sales.

## Close Price

Close price is the final transaction price reported for a closed property record. It is different from the original list price and the list price recorded near the time of contract. Market statistics should exclude missing, zero, or otherwise invalid close prices.

Project field: `california_sold.ClosePrice`.

## List Price and Original List Price

List price is the asking price recorded at the relevant point in the listing history. Original list price is the asking price when the property was first listed. They are not interchangeable when measuring negotiation outcomes.

This project uses `california_sold.ListPrice` for the list-to-close ratio and retains `OriginalListPrice` for analyses of changes from the initial asking price.

Project fields: `california_sold.ListPrice` and `california_sold.OriginalListPrice`.

## List-to-Close Ratio

The list-to-close ratio compares the final close price with the list price:

`list-to-close ratio = ClosePrice / ListPrice * 100`

A result of 100% means the close price equaled the recorded list price. A result below 100% means it closed below list price, while a result above 100% means it closed above list price. The calculation must exclude records where `ClosePrice` or `ListPrice` is missing or not positive.

The ratio summarizes price negotiation but does not by itself establish whether a market favors buyers or sellers. Concessions, financing terms, property condition, and listing-price changes may not be reflected.

Project fields: `california_sold.ClosePrice` and `california_sold.ListPrice`.

## Price per Square Foot

Price per square foot normalizes a price by finished living area:

`price per square foot = price / LivingArea`

For sold-market analysis, this project uses `ClosePrice / LivingArea`. Records with missing or non-positive living area must be excluded. Price per square foot can help compare properties, but it does not fully account for location, condition, lot value, layout, view, or amenities.

Project fields: `california_sold.ClosePrice` and `california_sold.LivingArea`.

## Median Price

The median price is the middle valid price after prices are sorted. When there is an even number of observations, it is the average of the two middle values. The median is less sensitive to a small number of unusually expensive or inexpensive sales than the arithmetic average.

This project reports median close price only after filtering the city, property population, time window, and invalid prices. Medians from different filters or time periods should not be compared as though they represent identical populations.

## Inventory

Inventory generally refers to properties available for sale. In this project, active inventory is counted from active `rets_property` records. Sold volume is counted separately from `california_sold` over a stated period.

An active-count-to-sales comparison is not automatically "months of supply." A true months-of-supply calculation requires a clearly defined sales pace and time window.

## Escrow Account

A mortgage escrow account, also called an impound account in some locations, is an account managed by a mortgage lender or servicer to pay certain property-related expenses such as property taxes and homeowners insurance. Part of the borrower's payment may be deposited into the account, and the servicer pays eligible bills when due.

Mortgage escrow accounts should not be confused with transaction escrow, which refers to a neutral closing arrangement for holding funds or documents during a real estate transaction. The intended meaning must be clear from the question and source context.

Authority: U.S. Consumer Financial Protection Bureau, "What is an escrow or impound account?"

## Capitalization Rate (Cap Rate)

Capitalization rate, or cap rate, is an income-property measure that relates stabilized net operating income to property value or sale price:

`cap rate = stabilized net operating income / property value`

Cap rate is mainly relevant to income-producing real estate. It is not the same as mortgage interest rate, investment return, or appreciation rate. The current project tables do not provide a complete stabilized net operating income calculation, so the assistant must not calculate a reliable cap rate from the MLS fields alone.

Authority: Office of the Comptroller of the Currency, *Commercial Real Estate Lending, Comptroller's Handbook*.

## Homeowners Association (HOA) Fee

An HOA fee is an amount charged by a homeowners association to fund services, maintenance, reserves, or shared amenities governed by that association. Frequency matters: a monthly fee and an annual fee cannot be compared without normalization.

The project may display `AssociationFee`, but users should verify the amount, frequency, included services, assessments, and current association documents before relying on it.

Project fields include `AssociationFee`, `AssociationFeeFrequency`, `AssociationAmenities`, and `AssociationName` where available.

## Source Register

1. IDX Exchange, *AI Agentic Engineer Intern Handbook Summer 2026*. Internal project source for table definitions, Week 5 market calculations, and required RAG terminology.
2. Real Estate Standards Organization, Data Dictionary mapping materials. Reference for the standard field name `DaysOnMarket` and the common abbreviation `DOM`: https://www.reso.org/download/mls-workshop-migration-starter-kit-gregory-lemon/
3. Fannie Mae, appraisal guidance on selecting and supporting comparable sales: https://singlefamily.fanniemae.com/originating-underwriting/appraisers/appraiser-update-december-2024
4. U.S. Consumer Financial Protection Bureau, "What is an escrow or impound account?": https://www.consumerfinance.gov/ask-cfpb/what-is-an-escrow-or-impound-account-en-140/
5. Office of the Comptroller of the Currency, *Commercial Real Estate Lending, Comptroller's Handbook*: https://www.occ.treas.gov/publications-and-resources/publications/comptrollers-handbook/files/commercial-real-estate-lending/pub-ch-commercial-real-estate.pdf
