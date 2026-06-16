from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True  # Checks if database connection is alive before querying
)

# Create session maker session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()

# Database session dependency generator
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
