import os
from pathlib import Path
from urllib.parse import quote_plus

import geopandas as gpd
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine


PROJECT_ROOT = Path(__file__).resolve().parent.parent
GEOJSON_PATH = (
    PROJECT_ROOT
    / "data"
    / "california_school_districts_2025_26.geojson"
)
OUTPUT_PATH = (
    PROJECT_ROOT
    / "data"
    / "property_school_district_mapping.csv"
)


def create_database_engine():
    load_dotenv(PROJECT_ROOT / ".env")

    host = os.getenv("MYSQL_HOST", "localhost")
    port = os.getenv("MYSQL_PORT", "3306")
    user = os.getenv("MYSQL_USER")
    password = quote_plus(os.getenv("MYSQL_PASSWORD", ""))
    database = os.getenv("MYSQL_DATABASE")

    if not user or not database:
        raise ValueError("MYSQL_USER and MYSQL_DATABASE must be set in .env")

    url = (
        f"mysql+mysqlconnector://{user}:{password}"
        f"@{host}:{port}/{database}"
    )
    return create_engine(url)


def load_properties(engine):
    query = """
        SELECT
            id,
            L_ListingID,
            L_Address,
            L_City,
            LMD_MP_Latitude AS Latitude,
            LMD_MP_Longitude AS Longitude
        FROM rets_property
        WHERE LMD_MP_Latitude IS NOT NULL
          AND LMD_MP_Longitude IS NOT NULL
          AND LMD_MP_Latitude BETWEEN 32 AND 42
          AND LMD_MP_Longitude BETWEEN -125 AND -114
    """

    return pd.read_sql(query, engine)


def load_unified_districts():
    districts = gpd.read_file(GEOJSON_PATH)

    print("GeoJSON columns:", list(districts.columns))

    unified = districts[
        districts["DistrictType"]
        .fillna("")
        .str.strip()
        .str.casefold()
        .eq("unified")
    ].copy()

    unified = unified[["DistrictName", "geometry"]]
    return unified.to_crs("EPSG:4326")


def match_properties_to_districts(properties, districts):
    property_points = gpd.GeoDataFrame(
        properties,
        geometry=gpd.points_from_xy(
            properties["Longitude"],
            properties["Latitude"],
        ),
        crs="EPSG:4326",
    )

    matched = gpd.sjoin(
        property_points,
        districts,
        how="left",
        predicate="within",
    )

    return matched.drop(
        columns=["geometry", "index_right"],
        errors="ignore",
    )


def main():
    if not GEOJSON_PATH.exists():
        raise FileNotFoundError(
            f"GeoJSON was not found: {GEOJSON_PATH}"
        )

    engine = create_database_engine()

    properties = load_properties(engine)
    districts = load_unified_districts()
    matched = match_properties_to_districts(properties, districts)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    matched.to_csv(
        OUTPUT_PATH,
        index=False,
    )

    matched_count = matched["DistrictName"].notna().sum()
    unmatched_count = matched["DistrictName"].isna().sum()

    print(f"Valid properties: {len(properties):,}")
    print(f"Unified districts: {len(districts):,}")
    print(f"Matched properties: {matched_count:,}")
    print(f"Unmatched properties: {unmatched_count:,}")
    print(f"Output saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()