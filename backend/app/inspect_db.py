from app.database import SessionLocal
from app.models.country import Country
from app.models.metrics import EnergyMetric
from app.models.forecast import ForecastResult

db = SessionLocal()
try:
    country = db.query(Country).filter(Country.code == 'IND').first()
    if country:
        print(f"Country: {country.name} ({country.code})")
        print("\n--- HISTORICAL METRICS (last 5 years) ---")
        history = db.query(EnergyMetric).filter(EnergyMetric.country_id == country.id).order_by(EnergyMetric.year.desc()).limit(5).all()
        for h in reversed(history):
            print(f"Year: {h.year} | Gen: {h.electricity_generation:.1f} TWh | Emissions: {h.emissions:.1f} MT | Renew: {h.renewable_share*100:.1f}% | Pop: {h.population:.1f} | GDP: {h.gdp:.1f}")

        print("\n--- ENSEMBLE FORECASTS (first 5 years) ---")
        forecasts = db.query(ForecastResult).filter(
            ForecastResult.country_id == country.id,
            ForecastResult.metric_name == 'electricity_demand',
            ForecastResult.model_name == 'ensemble'
        ).order_by(ForecastResult.year).limit(5).all()
        for f in forecasts:
            print(f"Year: {f.year} | Predicted: {f.predicted_value:.1f} | Model: {f.model_name}")

        print("\n--- MODEL MAPEs ---")
        all_forecasts = db.query(ForecastResult).filter(
            ForecastResult.country_id == country.id,
            ForecastResult.metric_name == 'electricity_demand'
        ).all()
        models = set(f.model_name for f in all_forecasts)
        print(f"Stored models for demand: {models}")
        for m in models:
            first_f = db.query(ForecastResult).filter(
                ForecastResult.country_id == country.id,
                ForecastResult.metric_name == 'electricity_demand',
                ForecastResult.model_name == m
            ).order_by(ForecastResult.year).first()
            if first_f:
                print(f"Model: {m} | 2025 Pred: {first_f.predicted_value:.1f}")
    else:
        print("Country IND not found!")
finally:
    db.close()
