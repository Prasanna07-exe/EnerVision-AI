from pydantic import BaseModel
from typing import List, Optional

class ForecastDataPoint(BaseModel):
    year: int
    value: float
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None

class HistoricalDataPoint(BaseModel):
    year: int
    value: float

class ForecastResponse(BaseModel):
    country: str
    metric: str
    model: str
    historical: List[HistoricalDataPoint]
    forecast: List[ForecastDataPoint]
