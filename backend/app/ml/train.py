import os
import joblib
import logging
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_percentage_error, mean_absolute_error, root_mean_squared_error
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal
from app.models.country import Country
from app.models.metrics import EnergyMetric
from app.models.forecast import ForecastResult
from app.ml.preprocessing import create_lags_and_derivatives, prepare_training_data
from app.ml.models.xgboost_model import XGBoostForecaster
from app.ml.models.prophet_model import ProphetForecaster

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REGISTRY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "registry")
if not os.path.exists(REGISTRY_DIR):
    os.makedirs(REGISTRY_DIR)

TARGET_METRICS = {
    'electricity_generation': 'electricity_demand',
    'emissions': 'co2_emissions',
    'renewable_share': 'renewable_share'
}

def project_future_demographics(df_country: pd.DataFrame, future_years: list) -> pd.DataFrame:
    """Projects future GDP and population up to 2045 using linear trends."""
    years_hist = df_country['year'].values.reshape(-1, 1)
    
    # Population trend
    pop_model = LinearRegression().fit(years_hist, df_country['population'].values)
    pop_proj = pop_model.predict(np.array(future_years).reshape(-1, 1))
    
    # GDP trend
    gdp_model = LinearRegression().fit(years_hist, df_country['gdp'].values)
    gdp_proj = gdp_model.predict(np.array(future_years).reshape(-1, 1))
    
    df_proj = pd.DataFrame({
        'year': future_years,
        'population': np.clip(pop_proj, a_min=1.0, a_max=None),
        'gdp': np.clip(gdp_proj, a_min=1.0, a_max=None)
    })
    df_proj['gdp_per_capita'] = df_proj['gdp'] / df_proj['population']
    return df_proj

def train_and_forecast_all(db: Session):
    # 1. Load metrics data from database
    logger.info("Loading metrics from PostgreSQL database...")
    df_raw = pd.read_sql("SELECT * FROM energy_metrics", engine)
    if df_raw.empty:
        logger.warning("No metrics found in database. Please run the ETL pipeline first.")
        return

    # 2. Engineer features
    df = create_lags_and_derivatives(df_raw)

    countries = db.query(Country).all()
    future_years = list(range(2025, 2046))

    logger.info(f"Beginning ML modeling sequence for {len(countries)} countries...")
    for country in countries:
        df_country = df[df['country_id'] == country.id].sort_values(by='year')
        if len(df_country) < 10:
            # Skip countries with insufficient history (e.g. less than 10 years of records)
            continue

        logger.info(f"Modeling country: {country.name} ({country.code})")

        # Project demographic controls for the simulator/tabular models
        df_demographics_future = project_future_demographics(df_country, future_years)

        # Clear old forecasts for this country
        db.query(ForecastResult).filter(ForecastResult.country_id == country.id).delete()
        db.commit()

        # Fit models for each target metric
        for raw_metric, api_metric in TARGET_METRICS.items():
            # Get split data
            X_train, y_train, X_val, y_val, feature_names = prepare_training_data(df, country.id, raw_metric)
            if len(X_train) < 5 or len(X_val) < 2:
                continue

            # Model 1: XGBoost
            xgb_model = XGBoostForecaster()
            xgb_model.fit(X_train, y_train)
            xgb_mape = xgb_model.evaluate(X_val, y_val)

            # Model 2: Prophet
            prophet_model = ProphetForecaster()
            prophet_model.fit(df_country[df_country['year'] < 2019], raw_metric)
            # Evaluate Prophet
            prophet_val_preds = prophet_model.predict(list(X_val['year']))
            y_val_arr = np.array(y_val)
            mask = y_val_arr != 0
            prophet_mape = np.mean(np.abs((y_val_arr[mask] - prophet_val_preds[mask]) / y_val_arr[mask])) * 100 if mask.any() else 0.0

            # Model 3: Linear Regression (Baseline)
            lr_model = LinearRegression()
            lr_model.fit(X_train[['year', 'population', 'gdp']], y_train)
            lr_val_preds = lr_model.predict(X_val[['year', 'population', 'gdp']])
            lr_mape = np.mean(np.abs((y_val_arr[mask] - lr_val_preds[mask]) / y_val_arr[mask])) * 100 if mask.any() else 0.0

            # Choose the best model based on validation performance
            best_model_name = 'xgboost'
            best_mape = xgb_mape
            if prophet_mape < best_mape and prophet_mape > 0:
                best_model_name = 'prophet'
                best_mape = prophet_mape
            if lr_mape < best_mape and lr_mape > 0:
                best_model_name = 'linear_regression'
                best_mape = lr_mape

            # Save models to registry
            joblib.dump(xgb_model, os.path.join(REGISTRY_DIR, f"{country.code}_{api_metric}_xgb.joblib"))
            joblib.dump(lr_model, os.path.join(REGISTRY_DIR, f"{country.code}_{api_metric}_lr.joblib"))

            # Log model audit info
            logger.info(f"  Metric: {api_metric} | Validation MAPEs -> XGBoost: {xgb_mape:.2f}%, Prophet: {prophet_mape:.2f}%, Linear: {lr_mape:.2f}% (Best: {best_model_name})")

            # 4. Generate Future Forecasts (2025 - 2045)
            # Generate baseline predictions using best model
            if best_model_name == 'prophet':
                preds = prophet_model.predict(future_years)
            elif best_model_name == 'linear_regression':
                preds = lr_model.predict(df_demographics_future[['year', 'population', 'gdp']])
            else: # XGBoost (autoregressive projection)
                preds = []
                # Autoregressive sequential loop
                current_metrics = df_country.iloc[-1].to_dict()
                historical_lookups = df_country.set_index('year').to_dict('index')

                for y_idx, year in enumerate(future_years):
                    demo_row = df_demographics_future.iloc[y_idx]
                    
                    # Create lag values
                    lag_1_val = preds[-1] if len(preds) >= 1 else current_metrics[raw_metric]
                    if len(preds) >= 3:
                        lag_3_val = preds[-3]
                    elif len(preds) == 2:
                        lag_3_val = historical_lookups.get(2024, {}).get(raw_metric, 0.0)
                    elif len(preds) == 1:
                        lag_3_val = historical_lookups.get(2023, {}).get(raw_metric, 0.0)
                    else:
                        lag_3_val = historical_lookups.get(2022, {}).get(raw_metric, 0.0)

                    # For other lags required in features: extract historical or assume constant for simplicity
                    other_lag1_dem = historical_lookups.get(2024, {}).get('electricity_generation', 0.0)
                    other_lag3_dem = historical_lookups.get(2022, {}).get('electricity_generation', 0.0)
                    other_lag1_em = historical_lookups.get(2024, {}).get('emissions', 0.0)
                    other_lag3_em = historical_lookups.get(2022, {}).get('emissions', 0.0)
                    other_lag1_ren = historical_lookups.get(2024, {}).get('renewable_share', 0.0)
                    other_lag3_ren = historical_lookups.get(2022, {}).get('renewable_share', 0.0)

                    # Build feature row matching X_train column ordering
                    feature_row = pd.DataFrame([{
                        'year': year,
                        'population': demo_row['population'],
                        'gdp': demo_row['gdp'],
                        'gdp_per_capita': demo_row['gdp_per_capita'],
                        'electricity_generation_lag_1': lag_1_val if raw_metric == 'electricity_generation' else other_lag1_dem,
                        'electricity_generation_lag_3': lag_3_val if raw_metric == 'electricity_generation' else other_lag3_dem,
                        'emissions_lag_1': lag_1_val if raw_metric == 'emissions' else other_lag1_em,
                        'emissions_lag_3': lag_3_val if raw_metric == 'emissions' else other_lag3_em,
                        'renewable_share_lag_1': lag_1_val if raw_metric == 'renewable_share' else other_lag1_ren,
                        'renewable_share_lag_3': lag_3_val if raw_metric == 'renewable_share' else other_lag3_ren,
                        'ev_sales_share': 0.0 # Assumed baseline constant
                    }])

                    pred_val = xgb_model.predict(feature_row)[0]
                    preds.append(pred_val)

            # Post-process predictions to respect boundary conditions
            preds = np.array(preds)
            if raw_metric == 'renewable_share':
                preds = np.clip(preds, 0.0, 1.0)
            else:
                preds = np.clip(preds, 0.0, None)

            # 5. Save Forecast Results to Database
            # Generate dummy confidence intervals (e.g. standard error based on validation MAPE)
            std_err = (best_mape / 100.0) * preds
            confidence_lower = np.clip(preds - 1.96 * std_err, 0.0 if raw_metric != 'renewable_share' else 0.0, None if raw_metric != 'renewable_share' else 1.0)
            confidence_upper = np.clip(preds + 1.96 * std_err, 0.0, None if raw_metric != 'renewable_share' else 1.0)

            for i, year in enumerate(future_years):
                forecast_db = ForecastResult(
                    country_id=country.id,
                    year=year,
                    metric_name=api_metric,
                    predicted_value=float(preds[i]),
                    model_name=best_model_name,
                    confidence_lower=float(confidence_lower[i]),
                    confidence_upper=float(confidence_upper[i])
                )
                db.add(forecast_db)
            db.commit()

    logger.info("Training and forecasting run complete.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        train_and_forecast_all(db)
    finally:
        db.close()
