from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.country import Country
from app.schemas.country import CountryResponse
from app.services.cache_service import CacheService
from typing import List

router = APIRouter(prefix="/countries", tags=["Countries"])

@router.get("", response_model=List[CountryResponse])
def get_countries(db: Session = Depends(get_db)):
    """Returns a list of all seeded countries sorted alphabetically."""
    cache_key = "countries:list"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    countries = db.query(Country).order_by(Country.name).all()
    data = [
        {"id": c.id, "code": c.code, "name": c.name, "region": c.region}
        for c in countries
    ]
    CacheService.set(cache_key, data, ttl=3600)
    return countries
