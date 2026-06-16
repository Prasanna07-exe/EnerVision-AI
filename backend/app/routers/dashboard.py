from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.metrics import EnergyMetric
from app.models.country import Country

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/kpis")
def get_kpis(db: Session = Depends(get_db)):
    """Fetches high-level global KPIs and spotlight country parameters."""
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

    return {
        "year": latest_year,
        "global": {
            "electricity_generation": float(global_stats.generation or 0.0),
            "emissions": float(global_stats.emissions or 0.0),
            "renewable_share": float(global_stats.avg_renewables or 0.0)
        },
        "countries": countries_data
    }

@router.get("/mix")
def get_global_mix(db: Session = Depends(get_db)):
    """Fetches year-by-year global energy generation mix (1990-present)."""
    mix_data = db.query(
        EnergyMetric.year,
        func.sum(EnergyMetric.coal_generation).label("coal"),
        func.sum(EnergyMetric.gas_generation).label("gas"),
        func.sum(EnergyMetric.solar_generation).label("solar"),
        func.sum(EnergyMetric.wind_generation).label("wind"),
        func.sum(EnergyMetric.hydro_generation).label("hydro"),
        func.sum(EnergyMetric.nuclear_generation).label("nuclear")
    ).group_by(EnergyMetric.year).order_by(EnergyMetric.year).all()

    return [
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

@router.get("/map")
def get_map_data(db: Session = Depends(get_db)):
    """Returns country emissions for map coloring coordinates."""
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

    return [
        {
            "code": r.code,
            "name": r.name,
            "emissions": float(r.emissions or 0.0),
            "renewable_share": float(r.renewable_share or 0.0)
        }
        for r in map_stats
    ]
