from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.simulator import run_simulation
from app.models.scenario import SavedScenario
from app.schemas.agent import SimulationRequestSchema
from pydantic import BaseModel

router = APIRouter(prefix="/simulate", tags=["Simulator"])

class SaveScenarioRequest(BaseModel):
    name: str
    solar_change: float
    ev_change: float
    coal_change: float

@router.post("")
def simulate(payload: SimulationRequestSchema, db: Session = Depends(get_db)):
    """Computes real-time forecast updates dynamically based on slider values."""
    try:
        results = run_simulation(
            db=db,
            country_code=payload.country_code,
            solar_change=payload.solar_change,
            ev_change=payload.ev_change,
            coal_change=payload.coal_change
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/save")
def save_scenario(payload: SaveScenarioRequest, db: Session = Depends(get_db)):
    """Saves a scenario simulation configuration to the database."""
    scenario = SavedScenario(
        name=payload.name,
        solar_capacity_change=payload.solar_change,
        ev_adoption_change=payload.ev_change,
        coal_usage_change=payload.coal_change
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return {"status": "success", "id": scenario.id}

@router.get("/saved")
def get_saved_scenarios(db: Session = Depends(get_db)):
    """Lists saved scenarios in descending chronological order."""
    scenarios = db.query(SavedScenario).order_by(SavedScenario.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "solar_change": s.solar_capacity_change,
            "ev_change": s.ev_adoption_change,
            "coal_change": s.coal_usage_change,
            "created_at": s.created_at
        }
        for s in scenarios
    ]
