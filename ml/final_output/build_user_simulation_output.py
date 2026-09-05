import json
from pathlib import Path
import geopandas as gpd
import numpy as np

BASE = Path(__file__).resolve().parents[1]

PREDICTIONS = BASE / "susceptibility" / "image_susceptibility_predictions.geojson"
RUNOUT = BASE / "runout" / "runout_envelopes.geojson"
OUTPUT = Path(__file__).resolve().parent / "user_simulation_ml_output.json"

print("\n=== USER SIMULATION + IMAGE MODEL ===\n")

rainfall = float(input("Simulated rainfall last 24h (mm): "))
swi = float(input("Simulated SWI (mm): "))

pred = gpd.read_file(PREDICTIONS)
runout = gpd.read_file(RUNOUT)

rain_factor = np.clip(rainfall / 200.0, 0, 1)
swi_factor = np.clip(swi / 200.0, 0, 1)
environment_factor = 0.5 * rain_factor + 0.5 * swi_factor

records = []

for i, row in pred.iterrows():
    image_score = float(row["probability"])

    combined_score = (
        0.70 * image_score +
        0.30 * environment_factor
    )

    record = {
        "slope_unit_id": int(row["slope_unit_id"]) if "slope_unit_id" in row else i,
        "probability": None,
        "susceptibility_score": float(combined_score),
        "image_model_score": image_score,
        "verification_status": "PENDING_VERIFICATION",
        "model_status": "PROTOTYPE_NOT_VALIDATED",
        "data_source": "USER_SIMULATED + REAL_MIZORAM_RASTER",
        "user_simulation": {
            "rainfall_24h_mm": rainfall,
            "swi_mm": swi
        },
        "risk_level": None,
        "exposure": None
    }

    if i < len(runout):
        record["runout"] = {
            "source": "R7_PROTOTYPE",
            "status": "PROTOTYPE_NOT_CALIBRATED"
        }

    records.append(record)

output = {
    "forecast_run": {
        "data_source": "USER_SIMULATED + REAL_MIZORAM_RASTER",
        "model_status": "PROTOTYPE_NOT_VALIDATED",
        "verification_status": "PENDING_VERIFICATION",
        "risk_level": "NOT_GENERATED",
        "note": "Prototype demonstration using real Mizoram raster imagery/features and user-entered simulated rainfall/SWI. Combined score is a demo heuristic, not a validated probability."
    },
    "predictions": records
}

with open(OUTPUT, "w") as f:
    json.dump(output, f, indent=2)

scores = [r["susceptibility_score"] for r in records]

print("\n=== OUTPUT CREATED ===")
print(f"Predictions: {len(records)}")
print(f"Mean prototype score: {np.mean(scores):.3f}")
print(f"Output: {OUTPUT}")
print("\nIMPORTANT: This is a prototype score, NOT a validated probability.")
print("Verification status: PENDING_VERIFICATION")
print("Risk level: NOT GENERATED")
