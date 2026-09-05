import json
from pathlib import Path
from datetime import datetime, timezone

import geopandas as gpd
import pandas as pd


# ============================================================
# PATHS
# ============================================================

BASE = Path("..")

PREDICTIONS = BASE / "susceptibility" / "image_susceptibility_predictions.geojson"
SWI_FILE = BASE / "tank" / "soil_water_index.csv"
RAIN_FILE = BASE / "rainfall" / "rainfall_clean.csv"
RUNOUT_FILE = BASE / "runout" / "runout_envelopes.geojson"

OUTPUT = Path("final_ml_output.json")


# ============================================================
# LOAD DATA
# ============================================================

print("1/5 Loading susceptibility predictions...")

gdf = gpd.read_file(PREDICTIONS)

print("Prediction units:", len(gdf))


print("2/5 Loading SWI and rainfall...")

swi = pd.read_csv(SWI_FILE)
rain = pd.read_csv(RAIN_FILE)

latest_swi = swi.iloc[-1]
latest_rain = rain.iloc[-1]

swi_value = float(latest_swi["swi_mm"])
rainfall_value = float(latest_rain["rainfall_mm"])
input_date = str(latest_swi["date"])


print("Latest SWI:", swi_value, "mm")
print("Latest rainfall:", rainfall_value, "mm")


print("3/5 Loading runout envelopes...")

runout = gpd.read_file(RUNOUT_FILE)

print("Runout envelopes:", len(runout))


# ============================================================
# CREATE PREDICTIONS
# ============================================================

print("4/5 Building final prediction contract...")

predictions = []

for idx, row in gdf.iterrows():

    probability = float(row["probability"])
    susceptibility = float(row["susceptibility_score"])

    lower = float(row["confidence_lower"])
    upper = float(row["confidence_upper"])

    # Use the corresponding runout envelope if available.
    if idx < len(runout):
        envelope = runout.iloc[idx].geometry.__geo_interface__
        angle = float(runout.iloc[idx]["angle_of_reach_deg"])
        runout_distance = float(
            runout.iloc[idx]["runout_distance_m"]
        )
    else:
        envelope = None
        angle = 32.0
        runout_distance = 500.0

    prediction = {
        "slope_unit_id": f"AZ-{idx + 1:04d}",

        "valid_from": f"{input_date}T20:00:00+05:30",

        "valid_to": f"{input_date}T08:00:00+05:30",

        "susceptibility_score": round(
            susceptibility,
            4
        ),

        "probability": round(
            probability,
            4
        ),

        "confidence_lower": round(
            lower,
            4
        ),

        "confidence_upper": round(
            upper,
            4
        ),

        "tank_state": {
            "s1_mm": round(
                float(swi.iloc[-1]["s1_mm"]),
                3
            ),

            "s2_mm": round(
                float(swi.iloc[-1]["s2_mm"]),
                3
            ),

            "s3_mm": round(
                float(swi.iloc[-1]["s3_mm"]),
                3
            ),

            "swi_mm": round(
                swi_value,
                3
            )
        },

        "rainfall": {
            "observed_24h_mm": rainfall_value,

            "forecast_24h_mm": rainfall_value,

            "fraction_of_map": None
        },

        "drivers": {
            "swi_mm": 0.30,

            "forecast_24h_mm": 0.25,

            "mean_slope_deg": 0.20,

            "has_road_cut": 0.0,

            "susceptibility_score": 0.15
        },

        "counterfactual": (
            "Prototype model: reduced antecedent rainfall "
            "would reduce the susceptibility score. "
            "Not calibrated."
        ),

        "data_quality": {
            "nearest_gauge_km": None,

            "rainfall_confidence": "SIMULATED"
        },

        "runout": {
            "method": (
                "empirical_angle_of_reach_PROTOTYPE"
            ),

            "angle_of_reach_deg": angle,

            "runout_distance_m": runout_distance,

            "source_citation": (
                "PLACEHOLDER -- prototype value; "
                "replace with literature citation "
                "before presentation"
            ),

            "envelope_geojson": envelope
        },

        "exposure": {
            "buildings_count": None,

            "population_estimate": None,

            "population_source": (
                "NOT_AVAILABLE_IN_PROTOTYPE"
            ),

            "is_estimate": True,

            "road_segments": [],

            "critical_facilities": []
        },

        "data_source": "SIMULATED",

        "model_status": "PROTOTYPE_NOT_VALIDATED"
    }

    predictions.append(prediction)


# ============================================================
# FINAL JSON
# ============================================================

output = {
    "forecast_run": {
        "run_ts": (
            datetime.now(
                timezone.utc
            ).isoformat()
        ),

        "input_cutoff_ts": input_date,

        "model_version": "prototype-v0.1",

        "is_hindcast": True,

        "_comment_cutoff": (
            "Prototype cutoff based on the latest "
            "available simulated input date."
        )
    },

    "predictions": predictions
}


# ============================================================
# WRITE FILE
# ============================================================

print("5/5 Writing final JSON...")

with open(
    OUTPUT,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        output,
        f,
        indent=2
    )


print()
print("==============================")
print("R8 FINAL ML OUTPUT COMPLETE")
print("==============================")
print("Predictions:", len(predictions))
print("Output:", OUTPUT)
print("Data source: SIMULATED")
print("Status: PROTOTYPE_NOT_VALIDATED")
print("Risk level: NOT GENERATED")
