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

@router.get("/explain/{country_code}")
def explain_forecast(
    country_code: str,
    metric: str = "electricity_demand",
    db: Session = Depends(get_db)
):
    """
    Returns SHAP explainability feature attributions for the XGBoost model 
    on the first forecast step (2025) for the selected country and metric.
    """
    import os
    import joblib
    import pandas as pd
    import numpy as np
    from app.ml.preprocessing import create_lags_and_derivatives
    from app.ml.models.xgboost_model import XGBoostForecaster
    from app.ml.train import project_future_demographics
    from app.ml.shap_explainer import explain_prediction

    country = db.query(Country).filter(Country.code == country_code).first()
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")

    metric_mapping = {
        "electricity_demand": "electricity_generation",
        "co2_emissions": "emissions",
        "renewable_share": "renewable_share"
    }
    raw_metric = metric_mapping.get(metric)
    if not raw_metric:
        raise HTTPException(status_code=400, detail="Invalid metric name")

    # 1. Fetch historical metrics
    df_raw = pd.read_sql(f"SELECT * FROM energy_metrics WHERE country_id = {country.id}", db.bind)
    if len(df_raw) < 5:
        raise HTTPException(status_code=400, detail="Insufficient historical data for explainability")

    # 2. Create features
    df_features = create_lags_and_derivatives(df_raw)

    features = [
        'year', 'population', 'gdp', 'gdp_per_capita',
        'electricity_generation_lag_1', 'electricity_generation_lag_3',
        'emissions_lag_1', 'emissions_lag_3',
        'renewable_share_lag_1', 'renewable_share_lag_3',
        'ev_sales_share'
    ]

    # 3. Load model from registry, or train on-the-fly if missing
    # We resolve registry path relative to this file
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "ml", "registry", f"{country.code}_{metric}_xgb.joblib")
    
    if os.path.exists(model_path):
        xgb_forecaster = joblib.load(model_path)
    else:
        # Train on-the-fly to guarantee robustness
        X = df_features[features]
        y = df_features[raw_metric]
        xgb_forecaster = XGBoostForecaster()
        xgb_forecaster.fit(X, y)

    # 4. Construct feature row for 2025
    df_country_hist = df_features.sort_values(by='year')
    df_demo_proj = project_future_demographics(df_country_hist, [2025])
    
    last_hist = df_country_hist.iloc[-1].to_dict()
    hist_by_year = df_country_hist.set_index('year').to_dict('index')
    
    lag_1_dem = last_hist.get('electricity_generation', 0.0)
    lag_3_dem = hist_by_year.get(2022, {}).get('electricity_generation', 0.0)
    lag_1_em = last_hist.get('emissions', 0.0)
    lag_3_em = hist_by_year.get(2022, {}).get('emissions', 0.0)
    lag_1_ren = last_hist.get('renewable_share', 0.0)
    lag_3_ren = hist_by_year.get(2022, {}).get('renewable_share', 0.0)

    input_row = pd.DataFrame([{
        'year': 2025,
        'population': float(df_demo_proj.iloc[0]['population']),
        'gdp': float(df_demo_proj.iloc[0]['gdp']),
        'gdp_per_capita': float(df_demo_proj.iloc[0]['gdp_per_capita']),
        'electricity_generation_lag_1': float(lag_1_dem),
        'electricity_generation_lag_3': float(lag_3_dem),
        'emissions_lag_1': float(lag_1_em),
        'emissions_lag_3': float(lag_3_em),
        'renewable_share_lag_1': float(lag_1_ren),
        'renewable_share_lag_3': float(lag_3_ren),
        'ev_sales_share': float(last_hist.get('ev_sales_share', 0.0))
    }])

    background_data = df_features[features]

    # Predict target value
    pred_val = float(xgb_forecaster.predict(input_row)[0])
    if metric == "renewable_share":
        pred_val = max(0.0, min(1.0, pred_val))
    else:
        pred_val = max(0.0, pred_val)

    # 5. Run Sampling Shapley
    explanation = explain_prediction(xgb_forecaster, input_row, background_data, pred_val)
    return explanation

@router.get("/attention/{country_code}")
def get_lstm_attention(
    country_code: str,
    db: Session = Depends(get_db)
):
    """
    Loads the trained PyTorch EnergyLSTM model for the country, runs it on the
    latest 5-year historical lag sequence, and returns the temporal attention weights.
    """
    import os
    import joblib
    import pandas as pd
    import numpy as np
    import torch
    from app.ml.models.lstm_model import EnergyLSTM

    country = db.query(Country).filter(Country.code == country_code).first()
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "ml", "registry", f"{country.code}_lstm.pt")
    scaler_path = os.path.join(base_dir, "ml", "registry", f"{country.code}_lstm_scaler.joblib")

    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        # Return fallback uniform attention if models aren't pre-trained for this country
        return {
            "years": [2020, 2021, 2022, 2023, 2024],
            "attention": [0.2, 0.2, 0.2, 0.2, 0.2]
        }

    # 1. Fetch historical metrics
    df_raw = pd.read_sql(
        f"SELECT year, electricity_generation, emissions, renewable_share, population, gdp, ev_sales_share FROM energy_metrics WHERE country_id = {country.id} ORDER BY year",
        db.bind
    )
    if len(df_raw) < 5:
        raise HTTPException(status_code=400, detail="Insufficient historical data for LSTM attention")

    # Fill NaN values
    df_raw = df_raw.fillna(0.0)

    # 2. Extract features matching lstm_cols in train.py
    # lstm_cols = ['electricity_generation', 'emissions', 'renewable_share', 'population', 'gdp', 'gdp_per_capita', 'ev_sales_share']
    df_raw['gdp_per_capita'] = df_raw['gdp'] / df_raw['population'].replace(0.0, 1.0)
    
    lstm_cols = ['electricity_generation', 'emissions', 'renewable_share', 'population', 'gdp', 'gdp_per_capita', 'ev_sales_share']
    hist_data = df_raw[lstm_cols].values

    # 3. Transform using the minmax scaler
    scaler = joblib.load(scaler_path)
    scaled_data = scaler.transform(hist_data)
    
    # Take the last 5 years sequence
    last_sequence = scaled_data[-5:]

    # 4. Load PyTorch model
    model = EnergyLSTM(input_dim=len(lstm_cols), hidden_dim=32, num_layers=2, output_dim=3)
    model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
    model.eval()

    # 5. Extract attention weights
    x_tensor = torch.tensor(last_sequence, dtype=torch.float32).unsqueeze(0) # shape (1, 5, 7)
    with torch.no_grad():
        _, weights = model(x_tensor, return_attention=True)
        
    # weights shape: (1, 5, 1) -> squeeze to (5,)
    attention_weights = weights.squeeze().numpy().tolist()
    if isinstance(attention_weights, float):
        attention_weights = [attention_weights]
        
    years = [int(y) for y in df_raw['year'].values[-5:]]

    return {
        "years": years,
        "attention": attention_weights
    }
