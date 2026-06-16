import os
import logging
import requests
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.country import Country
from app.models.metrics import EnergyMetric

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
OWID_URL = "https://nyc3.digitaloceanspaces.com/owid-public/data/energy/owid-energy-data.csv"
IEA_EV_URL = "https://raw.githubusercontent.com/janhavi97/Global-EV-Dataset-Analysis/main/Global%20EV%20Data.csv"

def download_and_cache_datasets():
    """Download and cache raw datasets locally to speed up iterations."""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        logger.info(f"Created data directory at {DATA_DIR}")

    owid_path = os.path.join(DATA_DIR, "owid_energy_data.csv")
    if not os.path.exists(owid_path):
        logger.info(f"Downloading OWID Energy dataset from {OWID_URL}...")
        response = requests.get(OWID_URL)
        response.raise_for_status()
        with open(owid_path, "wb") as f:
            f.write(response.content)
        logger.info("OWID dataset downloaded successfully.")
    else:
        logger.info("OWID dataset found in cache.")

    ev_path = os.path.join(DATA_DIR, "iea_ev_sales.csv")
    if not os.path.exists(ev_path):
        logger.info(f"Downloading IEA EV Sales dataset from {IEA_EV_URL}...")
        response = requests.get(IEA_EV_URL)
        response.raise_for_status()
        with open(ev_path, "wb") as f:
            f.write(response.content)
        logger.info("IEA EV Sales dataset downloaded successfully.")
    else:
        logger.info("IEA EV Sales dataset found in cache.")

def run_etl(db: Session, max_rows: int = None):
    """
    Run the ETL pipeline: read CSVs, clean, merge, calculate derivatives,
    and seed the PostgreSQL database.
    """
    download_and_cache_datasets()

    owid_path = os.path.join(DATA_DIR, "owid_energy_data.csv")
    ev_path = os.path.join(DATA_DIR, "iea_ev_sales.csv")

    # 1. Load datasets
    logger.info("Loading datasets into Pandas...")
    df_owid = pd.read_csv(owid_path)
    df_ev = pd.read_csv(ev_path)

    # 2. Clean OWID Data
    # Drop rows without standard country ISO codes (aggregate regions like world, continents have null or aggregate codes)
    df_owid = df_owid[df_owid['iso_code'].notna()]
    df_owid = df_owid[df_owid['iso_code'].str.len() == 3]
    # Restrict to post-1990 for modeling consistency
    df_owid = df_owid[df_owid['year'] >= 1990]

    # Clean EV Sales data
    # Filter for EV sales share (percent) in passenger cars
    df_ev_clean = df_ev[
        (df_ev['parameter'] == 'EV sales share') & 
        (df_ev['mode'] == 'Cars')
    ].copy()
    
    # Standardize EV country names to merge with OWID names
    # Map common differences
    country_mapping = {
        "USA": "United States",
        "United Kingdom": "United Kingdom",
        "China": "China",
        "India": "India",
        "Germany": "Germany",
        "France": "France"
    }
    df_ev_clean['country_standardized'] = df_ev_clean['region'].map(country_mapping).fillna(df_ev_clean['region'])

    # Pivot IEA EV sales share to get year-by-country mapping
    # Value represents percentage share of EV sales (e.g. 15.2 means 15.2%)
    df_ev_grouped = df_ev_clean.groupby(['country_standardized', 'year'])['value'].mean().reset_index()
    df_ev_grouped.rename(columns={'value': 'ev_sales_share', 'country_standardized': 'country'}, inplace=True)

    # Merge EV sales share with OWID data
    df_merged = pd.merge(df_owid, df_ev_grouped, on=['country', 'year'], how='left')

    # Fill NaN for EV share with 0.0 (especially for earlier years or countries without EV reporting)
    df_merged['ev_sales_share'] = df_merged['ev_sales_share'].fillna(0.0)

    # Fill generation values with 0.0 if NaN
    generation_cols = [
        'electricity_generation', 'solar_electricity', 'wind_electricity', 
        'hydro_electricity', 'coal_electricity', 'gas_electricity', 'nuclear_electricity'
    ]
    for col in generation_cols:
        if col in df_merged.columns:
            df_merged[col] = df_merged[col].fillna(0.0)

    # 3. Calculate derived metrics
    logger.info("Computing derived indicators...")
    # Renewable Share = (Solar + Wind + Hydro) / Total Generation
    df_merged['derived_renewable_share'] = 0.0
    valid_gen_mask = df_merged['electricity_generation'] > 0
    df_merged.loc[valid_gen_mask, 'derived_renewable_share'] = (
        df_merged.loc[valid_gen_mask, 'solar_electricity'].fillna(0.0) +
        df_merged.loc[valid_gen_mask, 'wind_electricity'].fillna(0.0) +
        df_merged.loc[valid_gen_mask, 'hydro_electricity'].fillna(0.0)
    ) / df_merged.loc[valid_gen_mask, 'electricity_generation']
    df_merged['derived_renewable_share'] = df_merged['derived_renewable_share'].clip(0.0, 1.0)

    # Forward fill GDP and population within countries to handle missing metadata
    df_merged['population'] = df_merged.groupby('iso_code')['population'].ffill().bfill()
    df_merged['gdp'] = df_merged.groupby('iso_code')['gdp'].ffill().bfill()
    
    # Greenhouse Gas Emissions (in CO2 equivalent) - fill missing values with 0.0 or check alternative column
    # OWID uses 'greenhouse_gas_emissions' or 'co2'
    emissions_col = 'greenhouse_gas_emissions' if 'greenhouse_gas_emissions' in df_merged.columns else 'co2'
    df_merged['emissions_clean'] = df_merged[emissions_col].fillna(0.0)

    # 4. Load Data to Database
    logger.info("Starting database loading...")
    unique_countries = df_merged[['iso_code', 'country']].drop_duplicates().values
    
    # Seed Countries
    country_map = {} # Maps code -> DB Country ID
    logger.info(f"Upserting {len(unique_countries)} countries...")
    for iso_code, country_name in unique_countries:
        # Simple upsert
        country_db = db.query(Country).filter(Country.code == iso_code).first()
        if not country_db:
            country_db = Country(
                code=iso_code,
                name=country_name,
                region="Global" # Default region
            )
            db.add(country_db)
            db.commit()
            db.refresh(country_db)
        country_map[iso_code] = country_db.id

    # Seed Energy Metrics
    logger.info("Seeding energy metrics...")
    metrics_records = []
    
    # Cap total rows for debugging/quick seed if specified
    data_rows = df_merged
    if max_rows:
        data_rows = df_merged.head(max_rows)

    count = 0
    for idx, row in data_rows.iterrows():
        country_id = country_map.get(row['iso_code'])
        if not country_id:
            continue

        year = int(row['year'])
        
        # Check if record already exists to perform update (upsert)
        metric_db = db.query(EnergyMetric).filter(
            EnergyMetric.country_id == country_id,
            EnergyMetric.year == year
        ).first()

        if not metric_db:
            metric_db = EnergyMetric(
                country_id=country_id,
                year=year
            )
            db.add(metric_db)

        # Populate/update fields
        metric_db.gdp = float(row['gdp']) if pd.notna(row['gdp']) else None
        metric_db.population = float(row['population']) if pd.notna(row['population']) else None
        metric_db.electricity_generation = float(row['electricity_generation'])
        metric_db.solar_generation = float(row['solar_electricity']) if 'solar_electricity' in row else 0.0
        metric_db.wind_generation = float(row['wind_electricity']) if 'wind_electricity' in row else 0.0
        metric_db.hydro_generation = float(row['hydro_electricity']) if 'hydro_electricity' in row else 0.0
        metric_db.coal_generation = float(row['coal_electricity']) if 'coal_electricity' in row else 0.0
        metric_db.gas_generation = float(row['gas_electricity']) if 'gas_electricity' in row else 0.0
        metric_db.nuclear_generation = float(row['nuclear_electricity']) if 'nuclear_electricity' in row else 0.0
        metric_db.emissions = float(row['emissions_clean'])
        metric_db.ev_sales_share = float(row['ev_sales_share'])
        metric_db.renewable_share = float(row['derived_renewable_share'])

        count += 1
        if count % 1000 == 0:
            db.commit()
            logger.info(f"Seeded {count} metrics records...")

    db.commit()
    logger.info(f"ETL Complete. Total seeded metrics records: {count}")
    return count
