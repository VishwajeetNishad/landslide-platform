import numpy as np
import pandas as pd
from pathlib import Path
from lightgbm import LGBMClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

OUTPUT = Path("prototype_training_data.csv")
MODEL_OUTPUT = Path("susceptibility_model.txt")

# ============================================================
# IMPORTANT:
# This dataset is SIMULATED because the repository contains
# no real landslide inventory/training labels.
# Do NOT use these metrics as real-world model accuracy.
# ============================================================

rng = np.random.default_rng(42)
N = 1000

# Terrain / hydrological prototype features
mean_slope_deg = rng.uniform(5, 45, N)
mean_curvature = rng.normal(0, 0.02, N)
swi_mm = rng.uniform(20, 800, N)
rainfall_24h_mm = rng.uniform(0, 200, N)

# Simulated susceptibility tendency.
# This is ONLY for demonstrating the ML pipeline.
risk_signal = (
    0.055 * mean_slope_deg
    + 0.003 * swi_mm
    + 0.008 * rainfall_24h_mm
    + 2.0 * np.abs(mean_curvature)
    + rng.normal(0, 2.0, N)
)

threshold = np.percentile(risk_signal, 65)
landslide = (risk_signal > threshold).astype(int)

df = pd.DataFrame({
    "mean_slope_deg": mean_slope_deg,
    "mean_curvature": mean_curvature,
    "swi_mm": swi_mm,
    "rainfall_24h_mm": rainfall_24h_mm,
    "landslide": landslide,
    "source": "SIMULATED"
})

df.to_csv(OUTPUT, index=False)

X = df[
    [
        "mean_slope_deg",
        "mean_curvature",
        "swi_mm",
        "rainfall_24h_mm",
    ]
]
y = df["landslide"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y,
)

model = LGBMClassifier(
    n_estimators=100,
    learning_rate=0.05,
    num_leaves=20,
    random_state=42,
    verbosity=-1,
)

model.fit(X_train, y_train)

probabilities = model.predict_proba(X_test)[:, 1]
auc = roc_auc_score(y_test, probabilities)

model.booster_.save_model(str(MODEL_OUTPUT))

print("\nR6 PROTOTYPE TRAINING COMPLETE")
print("Training rows:", len(X_train))
print("Test rows:", len(X_test))
print("Positive labels:", int(y.sum()))
print("Negative labels:", int((y == 0).sum()))
print("Prototype ROC-AUC:", round(auc, 3))
print("\nIMPORTANT:")
print("The training labels are SIMULATED.")
print("The ROC-AUC is NOT real-world validation.")
print("Model:", MODEL_OUTPUT)
print("Dataset:", OUTPUT)
