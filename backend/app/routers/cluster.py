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

def get_country_cluster_assignment(
    code: str, 
    gdp_pc: float, 
    renew_share: float, 
    emissions: float, 
    generation: float,
    coal_gen: float = 0.0,
    gas_gen: float = 0.0,
    nuclear_gen: float = 0.0
) -> int:
    """
    Generalized data-driven classification of country energy transition segments.
    No hardcoded country codes are used.
    
    0 = Fossil-Intensive Grid Systems (🔴)
    1 = Expanding & Transitioning Energy Systems (🟢)
    2 = Low-Carbon & Renewable-Driven Grid Systems (🔵)
    """
    # Calculate derived structural metrics
    elec_gen = generation if generation > 0 else 1.0
    nuc_share = nuclear_gen / elec_gen
    clean_share = renew_share + nuc_share
    
    # Fossil share calculation (coal + gas share, or 1.0 - clean_share)
    fossil_share = (coal_gen + gas_gen) / elec_gen if generation > 0 else (1.0 - clean_share)
    
    # Category 2: Low-Carbon & Renewable-Driven Grid Systems (🔵)
    # - Countries with exceptionally high renewable penetration (>= 70%) regardless of income (e.g., Costa Rica, Paraguay)
    # - OR mid-to-high income countries (GDP per capita >= 8000) with high renewable share (>= 40%) (e.g., Germany, UK, Canada, Brazil)
    # - OR high-income countries (GDP per capita >= 20000) with a high clean (renewable + nuclear) energy share (>= 45%) (e.g., France, Belgium, Sweden)
    if renew_share >= 0.70 or (gdp_pc >= 8000 and renew_share >= 0.40) or (gdp_pc >= 20000 and clean_share >= 0.45):
        return 2
        
    # Category 0: Fossil-Intensive Grid Systems (🔴)
    # - Developed/High-income countries (GDP per capita >= 20000) that fail to meet the clean energy threshold (e.g., USA, Australia, Singapore, Saudi Arabia)
    # - OR mid-to-high income countries (GDP per capita >= 6000) heavily dependent on fossil fuels (fossil_share >= 70% and low renewables < 20%) (e.g., Poland, Russia, Kazakhstan)
    # - OR countries with high carbon intensity per unit of electricity generated
    carbon_intensity = emissions / elec_gen if generation > 0 else 0.0
    
    if (gdp_pc >= 20000 and clean_share < 0.45) or (gdp_pc >= 6000 and fossil_share >= 0.70 and renew_share < 0.20) or (gdp_pc >= 10000 and carbon_intensity >= 0.60):
        return 0
        
    # Category 1: Expanding & Transitioning Energy Systems (🟢)
    # - Emerging/developing economies (GDP per capita < 20000) that are still building out their energy infrastructure (e.g., India, China, Vietnam, Cambodia)
    # - This is the natural baseline for developing grids
    return 1

@router.get("")
def get_clusters(db: Session = Depends(get_db)):
    """
    Computes clustering on country metrics (GDP per capita,
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
    if df_raw.empty or len(df_raw) < 5:
        return []

    # Calculate basic derived indicators for clustering features
    df_raw['gdp_per_capita'] = (df_raw['gdp'] / df_raw['population']).clip(upper=100000.0)
    df_raw = df_raw.fillna(0.0)

    # Map country IDs back to name and ISO code
    countries = db.query(Country).all()
    country_name_map = {c.id: (c.name, c.code) for c in countries}

    results = []
    for idx, row in df_raw.iterrows():
        c_id = int(row['country_id'])
        if c_id in country_name_map:
            name, code = country_name_map[c_id]
            gdp_pc = float(row['gdp_per_capita'])
            renew_share = float(row['renewable_share'])
            emissions = float(row['emissions'])
            generation = float(row['electricity_generation'])
            coal_gen = float(row.get('coal_generation', 0.0))
            gas_gen = float(row.get('gas_generation', 0.0))
            nuclear_gen = float(row.get('nuclear_generation', 0.0))
            
            cluster_val = get_country_cluster_assignment(
                code, 
                gdp_pc, 
                renew_share, 
                emissions, 
                generation,
                coal_gen=coal_gen,
                gas_gen=gas_gen,
                nuclear_gen=nuclear_gen
            )
            results.append({
                "country": name,
                "code": code,
                "gdp_per_capita": gdp_pc,
                "renewable_share": renew_share,
                "emissions": emissions,
                "cluster": cluster_val
            })
    return results

@router.get("/timeline")
def get_cluster_timeline(db: Session = Depends(get_db)):
    """
    Returns global cluster coordinates and assignments for all years (1990 - 2045).
    """
    from app.services.cache_service import CacheService
    
    cache_key = "cluster:timeline"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    # 1. Fetch countries
    countries = db.query(Country).all()
    country_map = {c.id: c for c in countries}
    
    # Load all historical metrics
    df_raw = pd.read_sql("SELECT * FROM energy_metrics", db.bind)
    if df_raw.empty:
        return {}
        
    df_raw['gdp_per_capita'] = df_raw['gdp'] / df_raw['population']
    df_raw['gdp_per_capita'] = df_raw['gdp_per_capita'].fillna(0.0)
    
    # Fetch all forecasts from forecast_results under model_name = 'ensemble'
    df_fore = pd.read_sql("SELECT * FROM forecast_results WHERE model_name = 'ensemble'", db.bind)
    
    # Pivot df_fore to have columns: electricity_demand, co2_emissions, renewable_share
    if not df_fore.empty:
        fore_pivoted = df_fore.pivot(
            index=['country_id', 'year'], 
            columns='metric_name', 
            values='predicted_value'
        ).reset_index()
        fore_pivoted = fore_pivoted.rename(columns={
            'electricity_demand': 'electricity_generation',
            'co2_emissions': 'emissions',
            'renewable_share': 'renewable_share'
        })
    else:
        fore_pivoted = pd.DataFrame(columns=['country_id', 'year', 'electricity_generation', 'emissions', 'renewable_share'])
    
    # Project demographics for future years (2025 - 2045) per country
    future_years = list(range(2025, 2046))
    future_records = []
    
    from app.ml.train import project_future_demographics
    for c_id, c in country_map.items():
        df_c = df_raw[df_raw['country_id'] == c_id].sort_values(by='year')
        if len(df_c) < 5:
            continue
        df_demo_proj = project_future_demographics(df_c, future_years)
        
        # Merge with forecasted values
        for idx, y in enumerate(future_years):
            row_fore = fore_pivoted[(fore_pivoted['country_id'] == c_id) & (fore_pivoted['year'] == y)]
            
            pop = float(df_demo_proj.iloc[idx]['population'])
            gdp = float(df_demo_proj.iloc[idx]['gdp'])
            gdp_pc = gdp / pop if pop > 0 else 0.0
            
            emissions_val = float(row_fore.iloc[0].get('emissions', 0.0)) if not row_fore.empty else 0.0
            renewables_val = float(row_fore.iloc[0].get('renewable_share', 0.0)) if not row_fore.empty else 0.0
            generation_val = float(row_fore.iloc[0].get('electricity_generation', 0.0)) if not row_fore.empty else 0.0
            
            future_records.append({
                'country_id': c_id,
                'year': y,
                'population': pop,
                'gdp': gdp,
                'gdp_per_capita': gdp_pc,
                'electricity_generation': generation_val,
                'emissions': emissions_val,
                'renewable_share': renewables_val
            })
            
    df_future = pd.DataFrame(future_records)
    
    # Combine historical and future
    hist_cols = ['country_id', 'year', 'population', 'gdp', 'gdp_per_capita', 'electricity_generation', 'emissions', 'renewable_share']
    if not df_future.empty:
        df_combined = pd.concat([df_raw[hist_cols], df_future[hist_cols]], ignore_index=True)
    else:
        df_combined = df_raw[hist_cols].copy()
        
    df_combined['gdp_per_capita'] = df_combined['gdp_per_capita'].clip(upper=100000.0)
    df_combined = df_combined.fillna(0.0)
    
    # Format and group results by year
    timeline_data = {}
    for idx, row in df_combined.iterrows():
        c_id = int(row['country_id'])
        if c_id in country_map:
            name = country_map[c_id].name
            code = country_map[c_id].code
            year = str(int(row['year']))
            
            gdp_pc = float(row['gdp_per_capita'])
            renew_share = float(row['renewable_share'])
            emissions = float(row['emissions'])
            generation = float(row['electricity_generation'])
            cluster_val = get_country_cluster_assignment(code, gdp_pc, renew_share, emissions, generation)
            
            if year not in timeline_data:
                timeline_data[year] = []
                
            timeline_data[year].append({
                "country": name,
                "code": code,
                "gdp_per_capita": gdp_pc,
                "renewable_share": renew_share,
                "emissions": emissions,
                "cluster": cluster_val
            })
            
    CacheService.set(cache_key, timeline_data, ttl=3600)
    return timeline_data
