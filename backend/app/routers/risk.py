from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.risk_service import calculate_risk_scores

router = APIRouter(prefix="/risk", tags=["Risk Scoring"])

@router.get("/{country_code}")
def get_risk_scores(country_code: str, db: Session = Depends(get_db)):
    """Computes and retrieves supply, transition, and emission risk scores for a country."""
    try:
        scores = calculate_risk_scores(db, country_code)
        return scores
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
