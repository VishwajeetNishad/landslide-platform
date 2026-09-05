import json
from pathlib import Path
import geopandas as gpd
import numpy as np
from collections import Counter

BASE = Path(__file__).resolve().parents[1]
PREDICTIONS = BASE / "susceptibility" / "image_susceptibility_predictions.geojson"
RUNOUT = BASE / "runout" / "runout_envelopes.geojson"
OUTPUT = Path(__file__).resolve().parent / "final_user_simulation_output.json"

print("\n=== FINAL ML RISK PROTOTYPE ===\n")

rainfall = float(input("Rainfall last 24h (mm): "))
swi = float(input("Soil Water Index (mm): "))

pred = gpd.read_file(PREDICTIONS)
runout = gpd.read_file(RUNOUT)

rain_factor = np.clip(rainfall / 200.0, 0, 1)
swi_factor = np.clip(swi / 200.0, 0, 1)
environment_factor = 0.5 * rain_factor + 0.5 * swi_factor

areas = np.array([float(g.area) for g in runout.geometry])
area_min = np.percentile(areas, 5)
area_max = np.percentile(areas, 95)

records = []

for i, row in pred.iterrows():

    image_score = row["probability"]

    # No image prediction = do NOT calculate risk
    if image_score is None or not np.isfinite(float(image_score)):
        records.append({
            "slope_unit_id": int(row["slope_unit_id"]) if "slope_unit_id" in row else i,
            "susceptibility_score": None,
            "image_model_score": None,
            "likelihood": None,
            "exposure_score": None,
            "risk_score": None,
            "risk_level": "INSUFFICIENT_DATA",
            "verification_status": "PENDING_VERIFICATION",
            "model_status": "PROTOTYPE_NOT_VALIDATED",
            "data_source": "USER_PROVIDED_INPUT + MIZORAM_RASTER"
        })
        continue

    image_score = float(image_score)

    likelihood = 0.70 * image_score + 0.30 * environment_factor

    area = float(runout.iloc[i].geometry.area)

    exposure_score = float(np.clip(
        (area - area_min) / (area_max - area_min),
        0, 1
    ))

    risk_score = float(likelihood * exposure_score)

    if risk_score < 0.15:
        risk_level = "LOW"
    elif risk_score < 0.35:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    records.append({
        "slope_unit_id": int(row["slope_unit_id"]) if "slope_unit_id" in row else i,
        "susceptibility_score": float(likelihood),
        "image_model_score": image_score,
        "likelihood": float(likelihood),
        "exposure_score": exposure_score,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "verification_status": "PENDING_VERIFICATION",
        "model_status": "PROTOTYPE_NOT_VALIDATED",
        "data_source": "USER_PROVIDED_INPUT + MIZORAM_RASTER"
    })

output = {
    "forecast_run": {
        "data_source": "USER_PROVIDED_INPUT + MIZORAM_RASTER",
        "model_status": "PROTOTYPE_NOT_VALIDATED",
        "verification_status": "PENDING_VERIFICATION",
        "risk_formula": "likelihood × exposure"
    },
    "predictions": records
}

with open(OUTPUT, "w") as f:
    json.dump(output, f, indent=2, allow_nan=False)

counts = Counter(r["risk_level"] for r in records)

print("\n=== FINAL OUTPUT CREATED ===")
print(f"Predictions: {len(records)}")
print(f"LOW: {counts['LOW']}")
print(f"MEDIUM: {counts['MEDIUM']}")
print(f"HIGH: {counts['HIGH']}")
print(f"INSUFFICIENT_DATA: {counts['INSUFFICIENT_DATA']}")
print(f"Output: {OUTPUT}")
print("\nVerification: PENDING_VERIFICATION")
print("Model: PROTOTYPE_NOT_VALIDATED")
