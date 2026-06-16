from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from app.database import get_db, engine
from app.models.country import Country
from app.models.metrics import EnergyMetric

router = APIRouter(prefix="/cluster", tags=["Clustering"])

@router.get("")
def get_clusters(db: Session = Depends(get_db)):
    """
    Computes KMeans clustering dynamically on country metrics (GDP per capita,
    renewable share, carbon intensity, and energy intensity) for the latest year.
    """
    latest_year = db.query(func.max(EnergyMetric.year)).scalar()
    if not latest_year:
        return []

    # Load latest metrics
    df_raw = pd.read_sql(
        f"SELECT * FROM energy_metrics WHERE year = {latest_year}", 
        engine
    )
    # Require at least 5 countries to run clustering cleanly
    if df_raw.empty or len(df_raw) < 5:
        return []

    # Calculate basic derived indicators for clustering features
    df_raw['gdp_per_capita'] = df_raw['gdp'] / df_raw['population']
    
    # Carbon Intensity of Electricity (gCO2 / kWh)
    df_raw['carbon_intensity_elec'] = 0.0
    valid_gen = df_raw['electricity_generation'] > 0
    df_raw.loc[valid_gen, 'carbon_intensity_elec'] = (
        df_raw.loc[valid_gen, 'emissions'] * 1000.0
    ) / df_raw.loc[valid_gen, 'electricity_generation']

    # Energy Intensity of GDP
    df_raw['energy_intensity_gdp'] = 0.0
    valid_gdp = df_raw['gdp'] > 0
    df_raw.loc[valid_gdp, 'energy_intensity_gdp'] = (
        df_raw.loc[valid_gdp, 'electricity_generation'] * 1e9
    ) / df_raw.loc[valid_gdp, 'gdp']

    # Clean missing values
    df_raw = df_raw.fillna(0.0)

    # Feature space for KMeans
    features = ['gdp_per_capita', 'renewable_share', 'carbon_intensity_elec', 'energy_intensity_gdp']
    X = df_raw[features].copy()

    # Scale feature values to have zero mean and unit variance
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Fit KMeans (3 distinct clusters)
    kmeans = KMeans(n_clusters=3, random_state=42, n_init='auto')
    df_raw['cluster'] = kmeans.fit_predict(X_scaled)

    # Map country IDs back to name and ISO code
    countries = db.query(Country).all()
    country_name_map = {c.id: (c.name, c.code) for c in countries}

    results = []
    for idx, row in df_raw.iterrows():
        c_id = int(row['country_id'])
        if c_id in country_name_map:
            name, code = country_name_map[c_id]
            results.append({
                "country": name,
                "code": code,
                "gdp_per_capita": float(row['gdp_per_capita']),
                "renewable_share": float(row['renewable_share']),
                "emissions": float(row['emissions']),
                "cluster": int(row['cluster'])
            })
    return results
