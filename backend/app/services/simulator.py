import logging
import numpy as np
from sqlalchemy.orm import Session
from app.models.country import Country
from app.models.forecast import ForecastResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_simulation(
    db: Session,
    country_code: str,
    solar_change: float,  # Percentage, e.g. +30.0
    ev_change: float,     # Percentage, e.g. +50.0
    coal_change: float     # Percentage, e.g. -20.0
) -> dict:
    """
    Recalculates 20-year forecasts for demand, renewable share, and emissions
    reactively based on slider scaling factors.
    """
    # 1. Fetch country
    country = db.query(Country).filter(Country.code == country_code).first()
    if not country:
        raise ValueError(f"Country with ISO code '{country_code}' not found.")

    # 2. Fetch baseline forecasts
    baselines = db.query(ForecastResult).filter(
        ForecastResult.country_id == country.id
    ).all()

    if not baselines:
        raise ValueError(f"No baseline forecasts found for country '{country.name}'. Please train models first.")

    # Group baselines by metric name and year
    baseline_data = {}
    for b in baselines:
        if b.metric_name not in baseline_data:
            baseline_data[b.metric_name] = {}
        baseline_data[b.metric_name][b.year] = b.predicted_value

    years = sorted(list(set(b.year for b in baselines)))
    
    simulated_demand = []
    simulated_renewables = []
    simulated_emissions = []

    # 3. Apply sensitivity matrix calculations year-by-year
    for year in years:
        base_demand = baseline_data.get('electricity_demand', {}).get(year, 0.0)
        base_renewables = baseline_data.get('renewable_share', {}).get(year, 0.0)
        base_emissions = baseline_data.get('co2_emissions', {}).get(year, 0.0)

        # Formula 1: Grid demand adjusts to EV sales share growth
        # 100% EV adoption growth scales overall grid demand by 15%
        demand_factor = 1.0 + (ev_change / 100.0) * 0.15
        new_demand = base_demand * demand_factor

        # Formula 2: Renewable share adjusts to Solar Capacity expansions
        # 100% Solar Capacity growth increases renewable share proportionally
        renewable_factor = 1.0 + (solar_change / 100.0) * 0.50
        new_renewables = np.clip(base_renewables * renewable_factor, 0.0, 1.0)

        # Formula 3: CO2 emissions scale to coal reduction and solar replacement
        # 100% coal drop decreases emissions by 40%, 100% solar rise decreases emissions by 20%
        emissions_factor = 1.0 + (coal_change / 100.0) * 0.40 - (solar_change / 100.0) * 0.20
        new_emissions = np.clip(base_emissions * emissions_factor, 0.0, None)

        simulated_demand.append({
            "year": year,
            "value": float(new_demand)
        })
        simulated_renewables.append({
            "year": year,
            "value": float(new_renewables)
        })
        simulated_emissions.append({
            "year": year,
            "value": float(new_emissions)
        })

    return {
        "country": country.name,
        "code": country.code,
        "electricity_demand": simulated_demand,
        "renewable_share": simulated_renewables,
        "co2_emissions": simulated_emissions
    }
