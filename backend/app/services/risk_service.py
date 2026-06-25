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

    # 0. EV sales share expert calibration
    # If the database has 0.0, we apply real-world calibrated fallbacks for 2024
    KNOWN_EV_SHARES = {
        "SGP": 12.0,  # Singapore
        "KOR": 10.0,  # South Korea
        "HKG": 25.0,  # Hong Kong
        "ARE": 5.0,   # United Arab Emirates
        "TWN": 6.0,   # Taiwan
        "SAU": 1.5,   # Saudi Arabia
        "QAT": 2.0,   # Qatar
        "IRL": 18.0,  # Ireland
        "LUX": 20.0,  # Luxembourg
        "JPN": 3.5,   # Japan
        "BRA": 3.0,   # Brazil
        "IND": 2.2,   # India
        "ZAF": 0.8,   # South Africa
        "MEX": 1.8,   # Mexico
        "TUR": 5.0,   # Turkey
        "IDN": 2.0,   # Indonesia
        "THA": 10.0,  # Thailand
        "MYS": 2.5,   # Malaysia
    }

    gdp = latest_metric.gdp or 1.0
    pop = latest_metric.population or 1.0
    gdp_per_capita = gdp / pop

    ev_share = latest_metric.ev_sales_share or 0.0
    if ev_share == 0.0:
        if country.code in KNOWN_EV_SHARES:
            ev_share = KNOWN_EV_SHARES[country.code]
        else:
            # GDP-based fallback estimation for missing data
            if gdp_per_capita > 50000:
                ev_share = 15.0  # High-income default
            elif gdp_per_capita > 30000:
                ev_share = 8.0   # Upper-middle default
            elif gdp_per_capita > 15000:
                ev_share = 4.0   # Middle default
            elif gdp_per_capita > 5000:
                ev_share = 1.0   # Lower-middle default
            else:
                ev_share = 0.1   # Low-income default

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
    
    # Scale HHI risk by fossil share
    supply_risk = (fossil_share * 60) + (fossil_share * hhi * 40)
    supply_risk = int(np.clip(supply_risk, 10, 95))

    # 2. Emission Risk Calculation
    # High risk if coal generation is high and emissions per capita are elevated
    coal_share = (latest_metric.coal_generation or 0.0) / gen if gen > 0 else 0.0
    
    # Carbon footprint per capita (emissions in Million Tonnes -> * 1e6 to convert to Tonnes)
    emissions_per_capita = ((latest_metric.emissions or 0.0) * 1e6) / pop
    
    # Normalize emissions per capita relative to a global high standard (say 15.0 tonnes/capita)
    normalized_capita_emissions = np.clip(emissions_per_capita / 15.0, 0.0, 1.0)
    
    emission_risk = (coal_share * 60) + (normalized_capita_emissions * 40)
    emission_risk = int(np.clip(emission_risk, 10, 95))

    # 3. Transition Readiness Calculation
    # Low carbon share (renewables + nuclear)
    solar_gen = latest_metric.solar_generation or 0.0
    wind_gen = latest_metric.wind_generation or 0.0
    hydro_gen = latest_metric.hydro_generation or 0.0
    nuclear_gen = latest_metric.nuclear_generation or 0.0
    low_carbon_share = (solar_gen + wind_gen + hydro_gen + nuclear_gen) / gen if gen > 0 else 0.0
    low_carbon_share = min(1.0, max(0.0, low_carbon_share))

    # Logarithmic GDP per capita scaling (relative to 60,000 USD, floor at 1,000 USD)
    normalized_gdp_pc = np.clip((np.log10(gdp_per_capita) - 3.0) / (np.log10(60000.0) - 3.0), 0.0, 1.0)
    
    # Logarithmic Total GDP scaling (relative to 20 trillion USD, floor at 1 billion USD)
    normalized_gdp_total = np.clip((np.log10(gdp) - 9.0) / (np.log10(20e12) - 9.0), 0.0, 1.0)
    
    # Economic and industrial capacity blend
    economic_capacity = 0.5 * normalized_gdp_pc + 0.5 * normalized_gdp_total
    
    ev_factor = np.clip(ev_share / 30.0, 0.0, 1.0)
    
    # Readiness blends grid low-carbon share, economic scale, and EV momentum
    readiness = (low_carbon_share * 30) + (economic_capacity * 40) + (ev_factor * 20) + 10
    readiness = int(np.clip(readiness, 15, 95))

    return {
        "country": country.name,
        "code": country.code,
        "year": year,
        "supply_risk": supply_risk,
        "emission_risk": emission_risk,
        "transition_readiness": readiness
    }
