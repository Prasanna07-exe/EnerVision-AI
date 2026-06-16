from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base

class Country(Base):
    __tablename__ = "countries"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(3), unique=True, nullable=False, index=True)  # ISO-3 Code (e.g., "IND")
    name = Column(String(100), unique=True, nullable=False)
    region = Column(String(50), nullable=True)

    # Relationships
    metrics = relationship("EnergyMetric", back_populates="country", cascade="all, delete-orphan")
    forecasts = relationship("ForecastResult", back_populates="country", cascade="all, delete-orphan")
