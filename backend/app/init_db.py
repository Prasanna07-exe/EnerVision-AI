import logging
from app.database import engine, Base
# Import all models to register them with Base.metadata
from app.models import Country, EnergyMetric, ForecastResult, SavedScenario

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_tables():
    logger.info("Checking database connection and initializing tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("All database tables initialized successfully.")

if __name__ == "__main__":
    init_tables()
