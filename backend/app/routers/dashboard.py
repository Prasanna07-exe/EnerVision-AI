from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.metrics import EnergyMetric
from app.models.country import Country
from app.services.cache_service import CacheService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/kpis")
def get_kpis(db: Session = Depends(get_db)):
    """Fetches high-level global KPIs and spotlight country parameters."""
    cache_key = "dashboard:kpis"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    latest_year = db.query(func.max(EnergyMetric.year)).scalar()
    if not latest_year:
        return {
            "year": None,
            "global": {"electricity_generation": 0, "emissions": 0, "renewable_share": 0},
            "countries": []
        }

    # Query global sums
    global_stats = db.query(
        func.sum(EnergyMetric.electricity_generation).label("generation"),
        func.sum(EnergyMetric.emissions).label("emissions"),
        func.avg(EnergyMetric.renewable_share).label("avg_renewables")
    ).filter(EnergyMetric.year == latest_year).first()

    # Query specific spotlight countries
    spotlight_codes = ["USA", "CHN", "IND"]
    countries_data = []
    for code in spotlight_codes:
        country = db.query(Country).filter(Country.code == code).first()
        if country:
            m = db.query(EnergyMetric).filter(
                EnergyMetric.country_id == country.id,
                EnergyMetric.year == latest_year
            ).first()
            if m:
                countries_data.append({
                    "country": country.name,
                    "code": country.code,
                    "electricity_generation": m.electricity_generation or 0.0,
                    "emissions": m.emissions or 0.0,
                    "renewable_share": m.renewable_share or 0.0
                })

    result = {
        "year": latest_year,
        "global": {
            "electricity_generation": float(global_stats.generation or 0.0),
            "emissions": float(global_stats.emissions or 0.0),
            "renewable_share": float(global_stats.avg_renewables or 0.0)
        },
        "countries": countries_data
    }
    CacheService.set(cache_key, result, ttl=1800)
    return result

@router.get("/mix")
def get_global_mix(db: Session = Depends(get_db)):
    """Fetches year-by-year global energy generation mix (1990-present)."""
    cache_key = "dashboard:mix"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    mix_data = db.query(
        EnergyMetric.year,
        func.sum(EnergyMetric.coal_generation).label("coal"),
        func.sum(EnergyMetric.gas_generation).label("gas"),
        func.sum(EnergyMetric.solar_generation).label("solar"),
        func.sum(EnergyMetric.wind_generation).label("wind"),
        func.sum(EnergyMetric.hydro_generation).label("hydro"),
        func.sum(EnergyMetric.nuclear_generation).label("nuclear")
    ).group_by(EnergyMetric.year).order_by(EnergyMetric.year).all()

    result = [
        {
            "year": r.year,
            "coal": float(r.coal or 0.0),
            "gas": float(r.gas or 0.0),
            "solar": float(r.solar or 0.0),
            "wind": float(r.wind or 0.0),
            "hydro": float(r.hydro or 0.0),
            "nuclear": float(r.nuclear or 0.0)
        }
        for r in mix_data
    ]
    CacheService.set(cache_key, result, ttl=1800)
    return result

@router.get("/map")
def get_map_data(db: Session = Depends(get_db)):
    """Returns country emissions for map coloring coordinates."""
    cache_key = "dashboard:map"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    latest_year = db.query(func.max(EnergyMetric.year)).scalar()
    if not latest_year:
        return []

    map_stats = db.query(
        Country.code,
        Country.name,
        EnergyMetric.emissions,
        EnergyMetric.renewable_share
    ).join(EnergyMetric, EnergyMetric.country_id == Country.id).filter(
        EnergyMetric.year == latest_year
    ).all()

    result = [
        {
            "code": r.code,
            "name": r.name,
            "emissions": float(r.emissions or 0.0),
            "renewable_share": float(r.renewable_share or 0.0)
        }
        for r in map_stats
    ]
    CacheService.set(cache_key, result, ttl=1800)
    return result

@router.get("/correlation")
def get_correlation(codes: str, metric: str = None, db: Session = Depends(get_db)):
    """
    Computes Pearson Correlation Matrix:
    - Mode A (Multiple Countries, e.g. codes=IND,USA,CHN and metric=emissions):
      Calculates Pearson correlation between the countries' timeseries for the chosen metric.
    - Mode B (Single Country, e.g. codes=IND and metric=None):
      Calculates Pearson correlation between variables (GDP, emissions, renewable_share, generation)
      for that country over its historical years.
    """
    import pandas as pd
    import numpy as np

    country_list = [c.strip().upper() for c in codes.split(",") if c.strip()]
    if not country_list:
        return {"labels": [], "matrix": []}

    if len(country_list) > 1 and metric:
        # Mode A: Correlation between countries for a specific metric
        metric_mapping = {
            "electricity_demand": "electricity_generation",
            "co2_emissions": "emissions",
            "renewable_share": "renewable_share"
        }
        db_col = metric_mapping.get(metric, "emissions")

        # Query metrics for these countries
        data_dict = {}
        all_years = set()
        
        for code in country_list:
            country = db.query(Country).filter(Country.code == code).first()
            if not country:
                continue
            metrics = db.query(EnergyMetric.year, getattr(EnergyMetric, db_col).label("val")).filter(
                EnergyMetric.country_id == country.id,
                EnergyMetric.year <= 2024
            ).order_by(EnergyMetric.year).all()
            
            data_dict[code] = {m.year: m.val for m in metrics if m.val is not None}
            all_years.update(data_dict[code].keys())

        if not data_dict:
            return {"labels": [], "matrix": []}

        # Align on common years
        years_sorted = sorted(list(all_years))
        aligned_data = []
        for year in years_sorted:
            row = {"year": year}
            for code in country_list:
                row[code] = data_dict.get(code, {}).get(year, np.nan)
            aligned_data.append(row)

        df = pd.DataFrame(aligned_data).dropna()
        if len(df) < 3:
            return {"labels": country_list, "matrix": [[1.0 if i==j else 0.0 for j in range(len(country_list))] for i in range(len(country_list))]}

        corr = df[country_list].corr(method="pearson").fillna(0.0)
        
        return {
            "mode": "countries",
            "labels": country_list,
            "matrix": corr.values.tolist()
        }
    else:
        # Mode B: Correlation between variables for a single country
        code = country_list[0]
        country = db.query(Country).filter(Country.code == code).first()
        if not country:
            return {"labels": [], "matrix": []}

        metrics = db.query(
            EnergyMetric.gdp,
            EnergyMetric.emissions,
            EnergyMetric.renewable_share,
            EnergyMetric.electricity_generation
        ).filter(
            EnergyMetric.country_id == country.id,
            EnergyMetric.year <= 2024
        ).order_by(EnergyMetric.year).all()

        df_list = []
        for m in metrics:
            if m.gdp and m.emissions is not None and m.renewable_share is not None and m.electricity_generation is not None:
                df_list.append({
                    "GDP": m.gdp,
                    "Emissions": m.emissions,
                    "Renewable Share": m.renewable_share,
                    "Electricity Generation": m.electricity_generation
                })

        df = pd.DataFrame(df_list)
        labels = ["GDP", "Emissions", "Renewables", "Demand"]
        
        if len(df) < 3:
            return {"labels": labels, "matrix": [[1.0 if i==j else 0.0 for j in range(4)] for i in range(4)]}

        df.columns = labels
        corr = df.corr(method="pearson").fillna(0.0)

        return {
            "mode": "variables",
            "country": country.name,
            "labels": labels,
            "matrix": corr.values.tolist()
        }
