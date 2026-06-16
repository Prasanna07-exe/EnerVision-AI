import logging
from app.database import SessionLocal
from app.init_db import init_tables
from app.services.etl_service import run_etl

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    logger.info("Starting database and ETL initialization sequence...")
    
    # 1. Initialize all tables
    init_tables()
    
    # 2. Run ETL ingestion
    logger.info("Starting ingestion of historical energy & EV sales datasets...")
    db = SessionLocal()
    try:
        run_etl(db)
        logger.info("Seeding completed successfully.")
    except Exception as e:
        logger.error(f"Database seeding failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    main()
