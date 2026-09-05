import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
import joblib

X = np.load("training_data/X.npy")
y = np.load("training_data/y.npy")

# Convert each 32x32 patch into compact numerical features
features = np.column_stack([
    X.mean(axis=(1,2)),
    X.std(axis=(1,2)),
    np.percentile(X, 10, axis=(1,2)),
    np.percentile(X, 25, axis=(1,2)),
    np.percentile(X, 50, axis=(1,2)),
    np.percentile(X, 75, axis=(1,2)),
    np.percentile(X, 90, axis=(1,2)),
])

X_train, X_val, y_train, y_val = train_test_split(
    features,
    y,
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

print("Training Random Forest...")
model.fit(X_train, y_train)

pred = model.predict(X_val)

print("\n=== RESULTS ===")
print(classification_report(y_val, pred, digits=3))
print("Confusion Matrix:")
print(confusion_matrix(y_val, pred))

joblib.dump(model, "landslide_rf_event5.joblib")

print("\nMODEL SAVED: landslide_rf_event5.joblib")
