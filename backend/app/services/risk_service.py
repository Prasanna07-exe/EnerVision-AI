import logging
import numpy as np
from sqlalchemy.orm import Session
from app.models.country import Country
from app.models.metrics import EnergyMetric

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def calculate_risk_scores(db: Session, country_code: str) -> dict:
    """
    Computes three key indices for transition risk analysis based on
    the country's latest historical metric record.
    """
    # 1. Fetch country and latest metrics
    country = db.query(Country).filter(Country.code == country_code).first()
    if not country:
        raise ValueError(f"Country with ISO code '{country_code}' not found.")

    latest_metric = db.query(EnergyMetric).filter(
        EnergyMetric.country_id == country.id
    ).order_values_by = EnergyMetric.year.desc()
    
    # Executing descending query manually to get the latest record
    latest_metric = db.query(EnergyMetric).filter(
        EnergyMetric.country_id == country.id
    ).order_by(EnergyMetric.year.desc()).first()

    if not latest_metric or latest_metric.electricity_generation == 0:
        return {
            "country": country.name,
            "code": country.code,
            "year": None,
            "supply_risk": 50,
            "emission_risk": 50,
            "transition_readiness": 50
        }

    year = latest_metric.year
    gen = latest_metric.electricity_generation
    renewables = latest_metric.renewable_share or 0.0

    # 1. Supply Risk Calculation
    # High risk if dependent on fossil fuels (coal + gas) and lack of diversification
    fossil_gen = (latest_metric.coal_generation or 0.0) + (latest_metric.gas_generation or 0.0)
    fossil_share = fossil_gen / gen if gen > 0 else 0.0

    # Compute Herfindahl-Hirschman Index (HHI) for fuel concentration
    # Lower concentration = higher diversity = lower supply risk
    shares = [
        (latest_metric.coal_generation or 0.0) / gen if gen > 0 else 0,
        (latest_metric.gas_generation or 0.0) / gen if gen > 0 else 0,
        (latest_metric.solar_generation or 0.0) / gen if gen > 0 else 0,
        (latest_metric.wind_generation or 0.0) / gen if gen > 0 else 0,
        (latest_metric.hydro_generation or 0.0) / gen if gen > 0 else 0,
        (latest_metric.nuclear_generation or 0.0) / gen if gen > 0 else 0
    ]
    hhi = sum(s ** 2 for s in shares) # Ranges from ~0.16 to 1.0
    
    # Map fossil share and concentration to 0-100 scale
    supply_risk = (fossil_share * 60) + (hhi * 40)
    supply_risk = int(np.clip(supply_risk, 10, 95))

    # 2. Emission Risk Calculation
    # High risk if coal generation is high and emissions per capita are elevated
    coal_share = (latest_metric.coal_generation or 0.0) / gen if gen > 0 else 0.0
    
    # Carbon footprint per capita (emissions in Million Tonnes, population in Millions -> directly Tonnes/capita)
    pop = latest_metric.population or 1.0
    emissions_per_capita = (latest_metric.emissions or 0.0) / pop
    
    # Normalize emissions per capita relative to a global high standard (say 15.0 tonnes/capita)
    normalized_capita_emissions = np.clip(emissions_per_capita / 15.0, 0.0, 1.0)
    
    emission_risk = (coal_share * 60) + (normalized_capita_emissions * 40)
    emission_risk = int(np.clip(emission_risk, 10, 95))

    # 3. Transition Readiness Calculation
    # High readiness if renewable share is high and GDP per capita is elevated
    gdp = latest_metric.gdp or 1.0
    gdp_per_capita = gdp / pop
    
    # Normalize GDP per capita relative to high standard (say 60,000 USD)
    normalized_gdp = np.clip(gdp_per_capita / 60000.0, 0.0, 1.0)
    
    # Readiness blends actual renewables share with economic capacity
    readiness = (renewables * 50) + (normalized_gdp * 50)
    readiness = int(np.clip(readiness, 15, 95))

    return {
        "country": country.name,
        "code": country.code,
        "year": year,
        "supply_risk": supply_risk,
        "emission_risk": emission_risk,
        "transition_readiness": readiness
    }
