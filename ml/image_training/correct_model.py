import numpy as np
import joblib
from scipy.ndimage import uniform_filter
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

X = np.load("training_data/X.npy")
y = np.load("training_data/y.npy")

# Use the two most reliable patch statistics
features = np.column_stack([
    X.mean(axis=(1,2)),
    X.std(axis=(1,2))
])

X_train, X_val, y_train, y_val = train_test_split(
    features, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=12,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

print("Validation accuracy:", model.score(X_val, y_val))

joblib.dump(model, "landslide_rf_correct.joblib")

print("MODEL SAVED: landslide_rf_correct.joblib")
