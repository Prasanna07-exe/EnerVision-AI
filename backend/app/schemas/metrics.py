from pydantic import BaseModel
from typing import Optional

class EnergyMetricResponse(BaseModel):
    year: int
    gdp: Optional[float] = None
    population: Optional[float] = None
    electricity_generation: Optional[float] = None
    solar_generation: Optional[float] = None
    wind_generation: Optional[float] = None
    hydro_generation: Optional[float] = None
    coal_generation: Optional[float] = None
    gas_generation: Optional[float] = None
    nuclear_generation: Optional[float] = None
    emissions: Optional[float] = None
    ev_sales_share: Optional[float] = None
    renewable_share: Optional[float] = None

    class Config:
        from_attributes = True
