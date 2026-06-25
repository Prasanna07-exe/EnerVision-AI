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
import torch
import torch.nn as nn
import torch.optim as optim
from app.ml.models.lstm_model import EnergyLSTM, prepare_lstm_sequences
from sklearn.preprocessing import MinMaxScaler

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
    """Projects future GDP and population up to 2045 using linear trends based on the last 15 years of history."""
    df_recent = df_country.tail(15)
    years_hist = df_recent['year'].values.reshape(-1, 1)
    
    # Population trend
    pop_model = LinearRegression().fit(years_hist, df_recent['population'].values)
    pop_proj = pop_model.predict(np.array(future_years).reshape(-1, 1))
    
    # GDP trend
    gdp_model = LinearRegression().fit(years_hist, df_recent['gdp'].values)
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
    df_engineered = create_lags_and_derivatives(df_raw)

    # 3. Filter data to only include years since 2005 for modeling
    df = df_engineered[df_engineered['year'] >= 2005].copy()

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

        # Train PyTorch LSTM Model
        lstm_mapes = {}
        lstm_preds_future = {}
        has_lstm = False
        
        # Columns for LSTM: first 3 must be target metrics in order
        lstm_cols = ['electricity_generation', 'emissions', 'renewable_share', 'population', 'gdp', 'gdp_per_capita', 'ev_sales_share']
        
        try:
            hist_data = df_country[lstm_cols].values
            
            # Scale data using a scaler fitted on training portion (pre-2019)
            train_mask = df_country['year'] < 2019
            train_data = df_country.loc[train_mask, lstm_cols].values
            
            if len(train_data) >= 5:
                scaler = MinMaxScaler()
                scaler.fit(train_data)
                scaled_data = scaler.transform(hist_data)
                
                seq_length = 5
                X_all, y_all = prepare_lstm_sequences(scaled_data, seq_length)
                years_all = df_country['year'].values[seq_length:]
                
                # Split sequences into train and validation
                train_seq_mask = years_all < 2019
                val_seq_mask = (years_all >= 2019) & (years_all <= 2024)
                
                X_train_lstm = X_all[train_seq_mask]
                y_train_lstm = y_all[train_seq_mask]
                X_val_lstm = X_all[val_seq_mask]
                y_val_lstm = y_all[val_seq_mask]
                
                if len(X_train_lstm) >= 2 and len(X_val_lstm) >= 1:
                    X_train_tensor = torch.tensor(X_train_lstm, dtype=torch.float32)
                    y_train_tensor = torch.tensor(y_train_lstm, dtype=torch.float32)
                    X_val_tensor = torch.tensor(X_val_lstm, dtype=torch.float32)
                    y_val_tensor = torch.tensor(y_val_lstm, dtype=torch.float32)
                    
                    # Instantiate Model
                    lstm_model = EnergyLSTM(input_dim=len(lstm_cols), hidden_dim=32, num_layers=2, output_dim=3)
                    optimizer = optim.Adam(lstm_model.parameters(), lr=0.01)
                    criterion = nn.MSELoss()
                    
                    # Train model
                    epochs = 100
                    lstm_model.train()
                    for epoch in range(epochs):
                        optimizer.zero_grad()
                        outputs = lstm_model(X_train_tensor)
                        loss = criterion(outputs, y_train_tensor)
                        loss.backward()
                        optimizer.step()
                        
                    # Evaluate on validation
                    lstm_model.eval()
                    with torch.no_grad():
                        val_preds_scaled = lstm_model(X_val_tensor).numpy()
                        
                    # Helper to inverse scale first 3 columns
                    def inverse_scale_targets(preds_scaled_val, scaler_obj, num_features=7):
                        dummy = np.zeros((len(preds_scaled_val), num_features))
                        dummy[:, :3] = preds_scaled_val
                        dummy_inv = scaler_obj.inverse_transform(dummy)
                        return dummy_inv[:, :3]
                        
                    val_preds = inverse_scale_targets(val_preds_scaled, scaler)
                    y_val_actual = inverse_scale_targets(y_val_lstm, scaler)
                    
                    # Compute MAPE for each target
                    for i, (raw_metric, api_metric) in enumerate(TARGET_METRICS.items()):
                        actuals = y_val_actual[:, i]
                        preds = val_preds[:, i]
                        mask = actuals != 0
                        mape = np.mean(np.abs((actuals[mask] - preds[mask]) / actuals[mask])) * 100 if mask.any() else 0.0
                        lstm_mapes[api_metric] = mape
                        
                    # Fit final LSTM model and scaler on the full historical dataset (up to 2024)
                    scaler_full = MinMaxScaler()
                    scaler_full.fit(hist_data)
                    scaled_data_full = scaler_full.transform(hist_data)
                    
                    X_all_full, y_all_full = prepare_lstm_sequences(scaled_data_full, seq_length)
                    X_full_tensor = torch.tensor(X_all_full, dtype=torch.float32)
                    y_full_tensor = torch.tensor(y_all_full, dtype=torch.float32)
                    
                    lstm_model_full = EnergyLSTM(input_dim=len(lstm_cols), hidden_dim=32, num_layers=2, output_dim=3)
                    optimizer_full = optim.Adam(lstm_model_full.parameters(), lr=0.01)
                    criterion_full = nn.MSELoss()
                    
                    lstm_model_full.train()
                    for epoch in range(epochs):
                        optimizer_full.zero_grad()
                        outputs = lstm_model_full(X_full_tensor)
                        loss = criterion_full(outputs, y_full_tensor)
                        loss.backward()
                        optimizer_full.step()
                        
                    # Forecast future years (2025 - 2045) autoregressively with 100 Monte Carlo Dropout passes using full model
                    last_5_years_scaled = scaled_data_full[-seq_length:]
                    n_mc = 100
                    mc_trajectories = []
                    
                    for mc_run in range(n_mc):
                        preds_scaled_list = []
                        current_seq = last_5_years_scaled.copy()
                        
                        for idx, year in enumerate(future_years):
                            x_tensor = torch.tensor(current_seq[np.newaxis, :, :], dtype=torch.float32)
                            with torch.no_grad():
                                pred_step_scaled = lstm_model_full(x_tensor, mc_dropout=True).numpy()[0]
                            preds_scaled_list.append(pred_step_scaled)
                            
                            # Prepare feature row for next step
                            demo_row = df_demographics_future.iloc[idx]
                            pop = demo_row['population']
                            gdp = demo_row['gdp']
                            gdp_pc = demo_row['gdp_per_capita']
                            ev_share = 0.0 # baseline constant
                            
                            dummy_unscaled = np.zeros((1, len(lstm_cols)))
                            pred_unscaled = inverse_scale_targets(pred_step_scaled[np.newaxis, :], scaler_full)[0]
                            pred_unscaled[2] = np.clip(pred_unscaled[2], 0.0, 1.0)
                            pred_unscaled[0] = np.clip(pred_unscaled[0], 0.0, None)
                            pred_unscaled[1] = np.clip(pred_unscaled[1], 0.0, None)
                            
                            dummy_unscaled[0, 0] = pred_unscaled[0]
                            dummy_unscaled[0, 1] = pred_unscaled[1]
                            dummy_unscaled[0, 2] = pred_unscaled[2]
                            dummy_unscaled[0, 3] = pop
                            dummy_unscaled[0, 4] = gdp
                            dummy_unscaled[0, 5] = gdp_pc
                            dummy_unscaled[0, 6] = ev_share
                            
                            row_scaled = scaler_full.transform(dummy_unscaled)[0]
                            current_seq = np.vstack([current_seq[1:], row_scaled])
                        
                        traj_unscaled = inverse_scale_targets(np.array(preds_scaled_list), scaler_full)
                        mc_trajectories.append(traj_unscaled)
                        
                    mc_trajectories = np.array(mc_trajectories)
                    lstm_future_preds = mc_trajectories.mean(axis=0)
                    lstm_lower_preds = np.percentile(mc_trajectories, 2.5, axis=0)
                    lstm_upper_preds = np.percentile(mc_trajectories, 97.5, axis=0)
                    
                    lstm_lower_future = {}
                    lstm_upper_future = {}
                    
                    # Store forecasts in dict
                    for i, (raw_metric, api_metric) in enumerate(TARGET_METRICS.items()):
                        p = lstm_future_preds[:, i]
                        low = lstm_lower_preds[:, i]
                        upp = lstm_upper_preds[:, i]
                        
                        if raw_metric == 'renewable_share':
                            p = np.clip(p, 0.0, 1.0)
                            low = np.clip(low, 0.0, 1.0)
                            upp = np.clip(upp, 0.0, 1.0)
                        else:
                            p = np.clip(p, 0.0, None)
                            low = np.clip(low, 0.0, None)
                            upp = np.clip(upp, 0.0, None)
                            
                        lstm_preds_future[api_metric] = p
                        lstm_lower_future[api_metric] = low
                        lstm_upper_future[api_metric] = upp
                        
                    has_lstm = True
                    # Save LSTM model weights to registry
                    torch.save(lstm_model_full.state_dict(), os.path.join(REGISTRY_DIR, f"{country.code}_lstm.pt"))
                    joblib.dump(scaler_full, os.path.join(REGISTRY_DIR, f"{country.code}_lstm_scaler.joblib"))
        except Exception as e:
            logger.error(f"Failed to train LSTM for {country.code}: {str(e)}")
            has_lstm = False

        # Fit models for each target metric
        for raw_metric, api_metric in TARGET_METRICS.items():
            # Get split data
            X_train, y_train, X_val, y_val, feature_names = prepare_training_data(df, country.id, raw_metric)
            if len(X_train) < 5 or len(X_val) < 2:
                continue

            y_val_arr = np.array(y_val)
            mask = y_val_arr != 0

            # Model 1: XGBoost
            xgb_model = XGBoostForecaster()
            xgb_model.fit(X_train, y_train)
            xgb_mape = xgb_model.evaluate(X_val, y_val)

            # Model 2: Prophet
            prophet_model = ProphetForecaster()
            prophet_model.fit(df_country[df_country['year'] < 2019], raw_metric)
            # Evaluate Prophet
            if prophet_model.model is not None:
                prophet_val_preds = prophet_model.predict(list(X_val['year']))
                prophet_mape = np.mean(np.abs((y_val_arr[mask] - prophet_val_preds[mask]) / y_val_arr[mask])) * 100 if mask.any() else 0.0
            else:
                prophet_mape = 999.0

            # Model 3: Linear Regression (Baseline)
            lr_model = LinearRegression()
            lr_model.fit(X_train[['year', 'population', 'gdp']], y_train)
            lr_val_preds = lr_model.predict(X_val[['year', 'population', 'gdp']])
            lr_mape = np.mean(np.abs((y_val_arr[mask] - lr_val_preds[mask]) / y_val_arr[mask])) * 100 if mask.any() else 0.0

            # --- FIT FINAL MODELS ON ALL HISTORICAL DATA ---
            X_full = pd.concat([X_train, X_val])
            y_full = pd.concat([y_train, y_val])

            # Train final XGBoost
            xgb_model_full = XGBoostForecaster()
            xgb_model_full.fit(X_full, y_full)

            # Train final Prophet
            prophet_model_full = ProphetForecaster()
            prophet_model_full.fit(df_country[df_country['year'] <= 2024], raw_metric)

            # Train final Linear Regression
            lr_model_full = LinearRegression()
            lr_model_full.fit(X_full[['year', 'population', 'gdp']], y_full)

            # XGBoost forecasts (using final full model)
            xgb_preds = []
            current_metrics = df_country.iloc[-1].to_dict()
            historical_lookups = df_country.set_index('year').to_dict('index')

            for y_idx, year in enumerate(future_years):
                demo_row = df_demographics_future.iloc[y_idx]
                
                # Create lag values
                lag_1_val = xgb_preds[-1] if len(xgb_preds) >= 1 else current_metrics[raw_metric]
                if len(xgb_preds) >= 3:
                    lag_3_val = xgb_preds[-3]
                elif len(xgb_preds) == 2:
                    lag_3_val = historical_lookups.get(2024, {}).get(raw_metric, 0.0)
                elif len(xgb_preds) == 1:
                    lag_3_val = historical_lookups.get(2023, {}).get(raw_metric, 0.0)
                else:
                    lag_3_val = historical_lookups.get(2022, {}).get(raw_metric, 0.0)

                other_lag1_dem = historical_lookups.get(2024, {}).get('electricity_generation', 0.0)
                other_lag3_dem = historical_lookups.get(2022, {}).get('electricity_generation', 0.0)
                other_lag1_em = historical_lookups.get(2024, {}).get('emissions', 0.0)
                other_lag3_em = historical_lookups.get(2022, {}).get('emissions', 0.0)
                other_lag1_ren = historical_lookups.get(2024, {}).get('renewable_share', 0.0)
                other_lag3_ren = historical_lookups.get(2022, {}).get('renewable_share', 0.0)

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
                    'ev_sales_share': 0.0
                }])

                pred_val = xgb_model_full.predict(feature_row)[0]
                xgb_preds.append(pred_val)
            xgb_preds = np.array(xgb_preds)
            if raw_metric == 'renewable_share':
                xgb_preds = np.clip(xgb_preds, 0.0, 1.0)
            else:
                xgb_preds = np.clip(xgb_preds, 0.0, None)

            # Prophet forecasts (using final full model)
            prophet_preds = prophet_model_full.predict(future_years)
            if raw_metric == 'renewable_share':
                prophet_preds = np.clip(prophet_preds, 0.0, 1.0)
            else:
                prophet_preds = np.clip(prophet_preds, 0.0, None)

            # Linear regression forecasts (using final full model)
            lr_preds = lr_model_full.predict(df_demographics_future[['year', 'population', 'gdp']])
            if raw_metric == 'renewable_share':
                lr_preds = np.clip(lr_preds, 0.0, 1.0)
            else:
                lr_preds = np.clip(lr_preds, 0.0, None)

            # LSTM forecasts
            lstm_mape = lstm_mapes.get(api_metric, 999.0) if has_lstm else 999.0
            lstm_preds = lstm_preds_future.get(api_metric) if has_lstm else None

            # Choose the best model based on validation performance
            best_model_name = 'xgboost'
            best_mape = xgb_mape
            best_preds = xgb_preds
            best_lower = None
            best_upper = None
            
            if prophet_mape < best_mape and prophet_mape > 0:
                best_model_name = 'prophet'
                best_mape = prophet_mape
                best_preds = prophet_preds
            if lr_mape < best_mape and lr_mape > 0:
                best_model_name = 'linear_regression'
                best_mape = lr_mape
                best_preds = lr_preds
            if lstm_mape < best_mape and lstm_mape > 0:
                best_model_name = 'lstm'
                best_mape = lstm_mape
                best_preds = lstm_preds
                best_lower = lstm_lower_future.get(api_metric)
                best_upper = lstm_upper_future.get(api_metric)

            # Save models to registry
            joblib.dump(xgb_model_full, os.path.join(REGISTRY_DIR, f"{country.code}_{api_metric}_xgb.joblib"))
            joblib.dump(lr_model_full, os.path.join(REGISTRY_DIR, f"{country.code}_{api_metric}_lr.joblib"))

            # Log model audit info
            logger.info(f"  Metric: {api_metric} | Validation MAPEs -> XGBoost: {xgb_mape:.2f}%, Prophet: {prophet_mape:.2f}%, Linear: {lr_mape:.2f}%, LSTM: {lstm_mape:.2f}% (Best: {best_model_name})")

            # Helper function to save forecasts to DB
            def save_forecast(model_name_db, preds_arr, mape_val, lower_arr=None, upper_arr=None):
                if lower_arr is not None and upper_arr is not None:
                    confidence_lower = lower_arr
                    confidence_upper = upper_arr
                else:
                    std_err = (mape_val / 100.0) * preds_arr
                    confidence_lower = np.clip(preds_arr - 1.96 * std_err, 0.0 if raw_metric != 'renewable_share' else 0.0, None if raw_metric != 'renewable_share' else 1.0)
                    confidence_upper = np.clip(preds_arr + 1.96 * std_err, 0.0, None if raw_metric != 'renewable_share' else 1.0)
                
                for i, year in enumerate(future_years):
                    forecast_db = ForecastResult(
                        country_id=country.id,
                        year=year,
                        metric_name=api_metric,
                        predicted_value=float(preds_arr[i]),
                        model_name=model_name_db,
                        confidence_lower=float(confidence_lower[i]),
                        confidence_upper=float(confidence_upper[i])
                    )
                    db.add(forecast_db)

            # Write predictions for ALL models to DB
            save_forecast('xgboost', xgb_preds, xgb_mape)
            if prophet_model.model is not None:
                save_forecast('prophet', prophet_preds, prophet_mape)
            save_forecast('linear_regression', lr_preds, lr_mape)
            if has_lstm and lstm_preds is not None:
                save_forecast('lstm', lstm_preds, lstm_mape,
                              lower_arr=lstm_lower_future.get(api_metric),
                              upper_arr=lstm_upper_future.get(api_metric))
            
            # Calculate dynamic weights based on validation MAPEs (inverse-MAPE weighting)
            mapes = {}
            preds = {}
            
            mapes['xgboost'] = max(xgb_mape, 0.1)
            preds['xgboost'] = xgb_preds
            
            if prophet_model.model is not None and prophet_mape < 999:
                mapes['prophet'] = max(prophet_mape, 0.1)
                preds['prophet'] = prophet_preds
                
            mapes['linear_regression'] = max(lr_mape, 0.1)
            preds['linear_regression'] = lr_preds
            
            if has_lstm and lstm_preds is not None and lstm_mape < 999:
                mapes['lstm'] = max(lstm_mape, 0.1)
                preds['lstm'] = lstm_preds
                
            # Compute inverse MAPEs
            inv_mapes = {m: 1.0 / mape for m, mape in mapes.items()}
            sum_inv = sum(inv_mapes.values())
            weights = {m: inv / sum_inv for m, inv in inv_mapes.items()}
            
            # Print weights for auditing
            weights_str = ", ".join([f"{m}: {w*100:.1f}%" for m, w in weights.items()])
            logger.info(f"  Ensemble Weights for {country.code} ({api_metric}) -> {weights_str}")
            
            # Compute weighted ensemble forecasts and MAPE
            ensemble_preds = np.zeros_like(xgb_preds)
            ensemble_mape = 0.0
            for m, w in weights.items():
                ensemble_preds += w * preds[m]
                ensemble_mape += w * mapes[m]

            # Clip the ensemble predictions
            if raw_metric == 'renewable_share':
                ensemble_preds = np.clip(ensemble_preds, 0.0, 1.0)
            else:
                ensemble_preds = np.clip(ensemble_preds, 0.0, None)

            # Save the ensemble forecast
            save_forecast('ensemble', ensemble_preds, ensemble_mape)
            
            db.commit()

    logger.info("Training and forecasting run complete.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        train_and_forecast_all(db)
    finally:
        db.close()
