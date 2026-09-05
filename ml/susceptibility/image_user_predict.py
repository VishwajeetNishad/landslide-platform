import joblib
import numpy as np
import rasterio
from scipy.ndimage import uniform_filter

MODEL = "../image_training/landslide_rf_correct.joblib"
RASTER = "../image_training/data/mizoram_extracted/Mizoram/feature images/13-06-2021/after/indicies/slope.tif"

print("\n=== TerraGuard Image + User Simulation ===\n")

rainfall = float(input("Simulated rainfall last 24h (mm): "))
swi = float(input("Simulated SWI (mm): "))

if rainfall < 0 or swi < 0:
    raise ValueError("Rainfall and SWI cannot be negative.")

model = joblib.load(MODEL)

with rasterio.open(RASTER) as src:
    slope = src.read(1).astype(np.float32)

valid = np.isfinite(slope)

low = np.percentile(slope[valid], 2)
high = np.percentile(slope[valid], 98)

slope_norm = np.clip((slope - low) / (high - low), 0, 1)

median = np.nanmedian(slope_norm[valid])
slope_norm[~valid] = median

mean = uniform_filter(slope_norm, size=32, mode="nearest")
sqmean = uniform_filter(slope_norm ** 2, size=32, mode="nearest")
std = np.sqrt(np.maximum(sqmean - mean ** 2, 0))

X = np.column_stack([mean.ravel(), std.ravel()])

image_probability = model.predict_proba(X)[:, 1]
image_probability = image_probability.reshape(slope.shape)

# User simulation adjustment.
# This is a DEMO heuristic, not a learned rainfall/SWI relationship.
rain_factor = np.clip(rainfall / 200.0, 0, 1)
swi_factor = np.clip(swi / 200.0, 0, 1)

environment_factor = 0.5 * rain_factor + 0.5 * swi_factor

final_probability = (
    0.70 * image_probability +
    0.30 * environment_factor
)

final_probability[~valid] = np.nan

print("\n==============================")
print("IMAGE + USER SIMULATION RESULT")
print("==============================")
print(f"Rainfall input: {rainfall:.1f} mm")
print(f"SWI input: {swi:.1f} mm")
print(f"Image probability mean: {np.nanmean(image_probability):.3f}")
print(f"Combined prototype score: {np.nanmean(final_probability):.3f}")
print("Data source: USER_SIMULATED + REAL_MIZORAM_RASTER")
print("Status: PROTOTYPE_NOT_VALIDATED")
print("NOTE: Combined environmental adjustment is a demo heuristic, not a validated probability.")
