import xgboost as xgb
from sklearn.metrics import mean_absolute_percentage_error
import pandas as pd
import numpy as np

class XGBoostForecaster:
    def __init__(self):
        # Configured for robust time-series regression with moderate depth to prevent overfitting
        self.model = xgb.XGBRegressor(
            n_estimators=150,
            learning_rate=0.05,
            max_depth=5,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42
        )
        self.feature_names = []

    def fit(self, X: pd.DataFrame, y: pd.Series):
        self.feature_names = list(X.columns)
        self.model.fit(X, y)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        # Re-order features to guarantee matching training alignments
        X_aligned = X[self.feature_names]
        return self.model.predict(X_aligned)

    def evaluate(self, X_val: pd.DataFrame, y_val: pd.Series) -> float:
        """Returns the MAPE (Mean Absolute Percentage Error) in %."""
        if len(y_val) == 0:
            return 0.0
        preds = self.predict(X_val)
        # Avoid zero-division errors for countries with zero values (e.g. initial wind/solar shares)
        y_val_arr = np.array(y_val)
        mask = y_val_arr != 0
        if not mask.any():
            return 0.0
        
        mape = np.mean(np.abs((y_val_arr[mask] - preds[mask]) / y_val_arr[mask])) * 100
        return float(mape)
