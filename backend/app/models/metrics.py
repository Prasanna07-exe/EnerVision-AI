from sqlalchemy import Column, Integer, Double, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class EnergyMetric(Base):
    __tablename__ = "energy_metrics"

    id = Column(Integer, primary_key=True, index=True)
    country_id = Column(Integer, ForeignKey("countries.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    gdp = Column(Double, nullable=True)
    population = Column(Double, nullable=True)
    electricity_generation = Column(Double, nullable=True) # Total Electricity Generation (TWh)
    solar_generation = Column(Double, nullable=True)       # Solar Generation (TWh)
    wind_generation = Column(Double, nullable=True)        # Wind Generation (TWh)
    hydro_generation = Column(Double, nullable=True)       # Hydro Generation (TWh)
    coal_generation = Column(Double, nullable=True)        # Coal Generation (TWh)
    gas_generation = Column(Double, nullable=True)         # Gas Generation (TWh)
    nuclear_generation = Column(Double, nullable=True)     # Nuclear Generation (TWh)
    emissions = Column(Double, nullable=True)              # CO2 Emissions (Million Tonnes)
    ev_sales_share = Column(Double, nullable=True)         # EV sales share (0.0 - 100.0)
    renewable_share = Column(Double, nullable=True)        # Calculated (0.0 - 1.0)

    # Relationships
    country = relationship("Country", back_populates="metrics")

    # Composite Unique Constraint
    __table_args__ = (
        UniqueConstraint("country_id", "year", name="uq_country_year"),
    )
