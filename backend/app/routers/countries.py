from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.country import Country
from app.schemas.country import CountryResponse
from typing import List

router = APIRouter(prefix="/countries", tags=["Countries"])

@router.get("", response_model=List[CountryResponse])
def get_countries(db: Session = Depends(get_db)):
    """Returns a list of all seeded countries sorted alphabetically."""
    return db.query(Country).order_by(Country.name).all()
