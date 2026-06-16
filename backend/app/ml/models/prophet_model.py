import pandas as pd
import numpy as np
from typing import List
from prophet import Prophet
import logging

# Suppress Prophet internal optimizer logs
logging.getLogger('prophet').setLevel(logging.WARNING)

class ProphetForecaster:
    def __init__(self):
        self.model = None

    def fit(self, df_country: pd.DataFrame, target_col: str):
        """
        Fits Prophet on a single metric dataset.
        df_country must contain 'year' and the target_col.
        """
        try:
            # Prophet requires columns 'ds' (datetimes) and 'y' (target values)
            prophet_df = pd.DataFrame({
                'ds': pd.to_datetime(df_country['year'].astype(str) + '-01-01'),
                'y': df_country[target_col]
            })

            # Configured for long-term annual macroscopic trends (disable intra-year seasonality)
            self.model = Prophet(
                growth='linear',
                yearly_seasonality=False,
                weekly_seasonality=False,
                daily_seasonality=False
            )
            self.model.fit(prophet_df)
        except Exception as e:
            logging.warning(f"Prophet fitting failed, disabling Prophet for this run: {str(e)}")
            self.model = None

    def predict(self, years: List[int]) -> np.ndarray:
        """Forecasts values for the specified list of future years."""
        if self.model is None:
            return np.zeros(len(years))
        try:
            future_df = pd.DataFrame({
                'ds': pd.to_datetime(pd.Series(years).astype(str) + '-01-01')
            })
            forecast = self.model.predict(future_df)
            # yhat is the predicted column
            return forecast['yhat'].values
        except Exception as e:
            logging.warning(f"Prophet predict failed, returning zeros: {str(e)}")
            return np.zeros(len(years))
