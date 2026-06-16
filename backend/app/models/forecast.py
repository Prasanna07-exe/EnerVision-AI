from sqlalchemy import Column, Integer, Double, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class ForecastResult(Base):
    __tablename__ = "forecast_results"

    id = Column(Integer, primary_key=True, index=True)
    country_id = Column(Integer, ForeignKey("countries.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    metric_name = Column(String(50), nullable=False)   # 'electricity_demand', 'renewable_share', 'co2_emissions'
    predicted_value = Column(Double, nullable=False)
    model_name = Column(String(50), nullable=False)     # 'xgboost', 'prophet', 'lstm', 'ensemble'
    confidence_lower = Column(Double, nullable=True)
    confidence_upper = Column(Double, nullable=True)

    # Relationships
    country = relationship("Country", back_populates="forecasts")

    # Composite Unique Constraint
    __table_args__ = (
        UniqueConstraint("country_id", "year", "metric_name", "model_name", name="uq_country_year_metric_model"),
    )
