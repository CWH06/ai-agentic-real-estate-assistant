# Market Metrics Used by This Project

Document ID: `market-metrics`

Last reviewed: 2026-08-14

Purpose: Define the calculations used by the Week 5 market-statistics skill so RAG answers match the project's code and database.

Scope note: Metrics describe the filtered records in the imported dataset. They are not forecasts, appraisals, or recommendations to buy or sell.

## Required Query Scope

Every sold-market calculation needs a location and a time period. The project normally filters `california_sold` by `City` and a `CloseDate` window. The answer should say which city and how many months were used so the user can interpret the result.

Text matching for a city should be parameterized in SQL. Values must not be concatenated directly into a query string.

## Sold Count

Sold count is the number of qualifying `california_sold` rows in the requested city and closing-date window. Rows outside the window are not part of the count.

Formula: `sold count = COUNT(*)` after the required filters.

## Median and Average Close Price

Close-price statistics use `california_sold.ClosePrice`. Missing, zero, and negative prices are excluded.

Average close price is the arithmetic mean:

`average close price = SUM(ClosePrice) / number of valid sales`

Median close price is the middle value after valid close prices are sorted. With an even number of values, it is the average of the two middle values. Median is usually less sensitive than average to a few unusually high or low sales.

## Sold Price per Square Foot

For each valid sold record:

`sold price per square foot = ClosePrice / LivingArea`

Both `ClosePrice` and `LivingArea` must be present and greater than zero. A market-level average price per square foot is the average of the valid row-level ratios used by the project's query. It should not be calculated by silently treating missing area as zero.

Price per square foot does not fully adjust for location, condition, lot, layout, view, or amenities.

## Average Days on Market

The project averages valid `california_sold.DaysOnMarket` values within the same market and time filters. DOM is described in the handbook as the number of days from listing to contract for this dataset.

Formula: `average DOM = SUM(valid DaysOnMarket) / number of rows with valid DOM`

MLS definitions and relisting behavior can vary, so this metric must be interpreted in the context of the source feed.

## List-to-Close Ratio

The list-to-close ratio measures the final close price as a percentage of the list price recorded in the sold row:

`list-to-close ratio = ClosePrice / ListPrice * 100`

The project's market result averages valid row-level ratios. A row is valid only when both `ClosePrice` and `ListPrice` are present and greater than zero.

Interpretation:

- `100%`: the property closed at its recorded list price.
- Below `100%`: the property closed below its recorded list price.
- Above `100%`: the property closed above its recorded list price.

Example: a close price of $990,000 and a list price of $1,000,000 produce a list-to-close ratio of 99%.

This is not the same as `ClosePrice / OriginalListPrice`. Price changes, seller concessions, financing terms, condition, and other transaction details may not be captured by the ratio.

## Active Inventory

Active inventory is counted separately from `rets_property`, normally with `L_Status = "Active"` and the requested city. It is a current-listing measure, not a count of sold rows.

An active count divided by one month's sales is not automatically a reliable months-of-supply metric. Months of supply requires a defined sales pace, matching geographic/property filters, and a clearly stated formula.

## Comparable-Sale Guardrails

Recent sold comps come from `california_sold`. Relevance may be improved by matching city, property type or subtype, living-area range, age, features, and recency. The result is a data-supported comparison, not a licensed appraisal.

The assistant should disclose when few valid records remain after filtering. It should not present a tiny or mismatched sample as a definitive market conclusion.

## Source Register

1. IDX Exchange, *AI Agentic Engineer Intern Handbook Summer 2026*. Internal project source for Week 5 calculations and deliverables.
2. Project implementation in `src/db/marketStats.ts`, which is the executable reference for current SQL filters and aggregations.
