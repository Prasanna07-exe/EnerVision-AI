from sqlalchemy import Column, Integer, String, Double, DateTime, func
from app.database import Base

class SavedScenario(Base):
    __tablename__ = "saved_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    solar_capacity_change = Column(Double, nullable=False) # percentage, e.g. 30.0 (+30%)
    ev_adoption_change = Column(Double, nullable=False)    # percentage, e.g. 50.0 (+50%)
    coal_usage_change = Column(Double, nullable=False)     # percentage, e.g. -20.0 (-20%)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
