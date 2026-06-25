import numpy as np
import pandas as pd
from typing import Dict, List, Any

def explain_prediction(model, input_row: pd.DataFrame, background_data: pd.DataFrame, target_val: float) -> Dict[str, Any]:
    """
    Computes local feature attribution (Sampling Shapley values) for a prediction.
    """
    features = list(input_row.columns)
    
    # Base value is the average prediction over the background dataset
    base_pred = float(model.predict(background_data).mean())
    
    # Calculate Shapley value approximations by sampling permutations
    shap_values = {f: 0.0 for f in features}
    
    # We run N iterations of sampling coalition paths
    n_samples = 15
    for _ in range(n_samples):
        # Random permutation of features
        perm = np.random.permutation(features)
        
        # We build up the feature vector from background mean to target row
        current_row = background_data.mean().to_frame().T
        current_row.columns = features
        
        # Baseline prediction
        prev_pred = float(model.predict(current_row)[0])
        
        for f in perm:
            # Replace baseline value with actual value
            current_row[f] = input_row[f].values[0]
            # Predict
            curr_pred = float(model.predict(current_row)[0])
            # Marginal contribution
            contrib = curr_pred - prev_pred
            shap_values[f] += contrib / n_samples
            prev_pred = curr_pred
            
    # Normalize Shapley values so their sum equals (prediction_value - base_value)
    pred_val = target_val
    actual_diff = pred_val - base_pred
    sum_shaps = sum(shap_values.values())
    if sum_shaps != 0:
        ratio = actual_diff / sum_shaps
        for f in shap_values:
            shap_values[f] = float(shap_values[f] * ratio)
    else:
        diff_eq = actual_diff / len(features)
        for f in shap_values:
            shap_values[f] = float(diff_eq)
            
    return {
        "base_value": float(base_pred),
        "prediction_value": float(pred_val),
        "attributions": {f: float(v) for f, v in shap_values.items()}
    }
