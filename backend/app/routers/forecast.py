from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.country import Country
from app.models.metrics import EnergyMetric
from app.models.forecast import ForecastResult
from app.schemas.forecast import ForecastResponse, HistoricalDataPoint, ForecastDataPoint

router = APIRouter(prefix="/forecast", tags=["Forecast"])

@router.get("/{country_code}", response_model=ForecastResponse)
def get_forecast(
    country_code: str, 
    metric: str = "electricity_demand", 
    model: str = "ensemble", 
    db: Session = Depends(get_db)
):
    """
    Returns unified historical time-series plus predicted future coordinates.
    Metric options: 'electricity_demand', 'co2_emissions', 'renewable_share'.
    """
    country = db.query(Country).filter(Country.code == country_code).first()
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")

    # Map client API metric keys to internal database metrics columns
    metric_mapping = {
        "electricity_demand": "electricity_generation",
        "co2_emissions": "emissions",
        "renewable_share": "renewable_share"
    }
    db_col = metric_mapping.get(metric, "electricity_generation")

    # 1. Fetch historical database metrics
    history = db.query(EnergyMetric).filter(
        EnergyMetric.country_id == country.id
    ).order_by(EnergyMetric.year).all()

    historical_points = []
    for h in history:
        val = getattr(h, db_col, None)
        if val is not None:
            historical_points.append(HistoricalDataPoint(year=h.year, value=float(val)))

    # 2. Fetch pre-calculated forecast results
    forecasts = db.query(ForecastResult).filter(
        ForecastResult.country_id == country.id,
        ForecastResult.metric_name == metric
    ).order_by(ForecastResult.year).all()

    forecast_points = []
    active_model = model

    # Fallback Option: If ML model registry hasn't populated this country yet, run linear trend on-the-fly
    if not forecasts:
        if len(historical_points) >= 2:
            from sklearn.linear_model import LinearRegression
            import numpy as np

            logger_msg = f"No pre-trained curves for {country.code}. Running linear regression fallback..."
            print(logger_msg)

            years_hist = np.array([h.year for h in historical_points]).reshape(-1, 1)
            vals_hist = np.array([h.value for h in historical_points])

            lr = LinearRegression().fit(years_hist, vals_hist)
            future_years = list(range(2025, 2046))
            preds = lr.predict(np.array(future_years).reshape(-1, 1))

            for idx, y in enumerate(future_years):
                val = float(preds[idx])
                if metric == "renewable_share":
                    val = float(np.clip(val, 0.0, 1.0))
                else:
                    val = float(np.clip(val, 0.0, None))

                forecast_points.append(ForecastDataPoint(
                    year=y,
                    value=val,
                    confidence_lower=val * 0.90,
                    confidence_upper=val * 1.10
                ))
            active_model = "linear_regression"
    else:
        # Select matching model or filter for default if model doesn't match
        # Checks if stored model matches requested parameter
        stored_models = list(set(f.model_name for f in forecasts))
        if model not in stored_models:
            # Fallback to the first available model
            model = stored_models[0] if stored_models else "ensemble"
        
        active_model = model
        for f in forecasts:
            if f.model_name == model:
                forecast_points.append(ForecastDataPoint(
                    year=f.year,
                    value=float(f.predicted_value),
                    confidence_lower=float(f.confidence_lower) if f.confidence_lower is not None else float(f.predicted_value * 0.90),
                    confidence_upper=float(f.confidence_upper) if f.confidence_upper is not None else float(f.predicted_value * 1.10)
                ))

    return ForecastResponse(
        country=country.name,
        metric=metric,
        model=active_model,
        historical=historical_points,
        forecast=forecast_points
    )
