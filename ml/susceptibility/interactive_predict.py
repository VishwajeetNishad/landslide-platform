import lightgbm as lgb
import numpy as np

MODEL_PATH = "susceptibility_model.txt"

model = lgb.Booster(model_file=MODEL_PATH)

print("\n=== TerraGuard Interactive Susceptibility Test ===")
print("Enter conditions for one slope unit.\n")

slope = float(input("Slope (degrees): "))
curvature = float(input("Curvature: "))
swi = float(input("SWI (mm): "))
rainfall = float(input("Rainfall in last 24h (mm): "))

X = np.array([[slope, curvature, swi, rainfall]])

prediction = model.predict(X)[0]

print("\n--------------------------------")
print(f"Susceptibility score: {prediction:.3f}")

if prediction >= 0.70:
    print("Prototype classification: HIGH")
elif prediction >= 0.40:
    print("Prototype classification: MODERATE")
else:
    print("Prototype classification: LOW")

print("--------------------------------")
print("NOTE: Prototype score only — not a validated real-world probability.")
