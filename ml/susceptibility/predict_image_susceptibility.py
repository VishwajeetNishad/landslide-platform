import numpy as np
import rasterio
import joblib
from pathlib import Path
from scipy.ndimage import uniform_filter

MODEL = Path("../image_training/landslide_rf_correct.joblib")

SLOPE = Path("../image_training/data/mizoram_extracted/Mizoram/feature images/13-06-2021/after/indicies/slope.tif")

OUTPUT = Path("image_susceptibility_probability.tif")

PATCH_SIZE = 32


print("1/4 Loading trained image model...")
model = joblib.load(MODEL)
print("Model loaded:", MODEL)


print("2/4 Loading Mizoram slope raster...")

with rasterio.open(SLOPE) as src:
    slope = src.read(1).astype(np.float32)
    profile = src.profile.copy()

print("Raster shape:", slope.shape)


print("3/4 Creating image features...")

valid = np.isfinite(slope)

if not np.any(valid):
    raise RuntimeError("No valid slope pixels found.")

low = np.percentile(slope[valid], 2)
high = np.percentile(slope[valid], 98)

if high <= low:
    raise RuntimeError("Invalid slope normalization range.")

slope_norm = np.clip((slope - low) / (high - low), 0, 1)

median_value = float(np.nanmedian(slope_norm[valid]))
slope_norm[~valid] = median_value

local_mean = uniform_filter(
    slope_norm,
    size=PATCH_SIZE,
    mode="nearest"
)

local_sq_mean = uniform_filter(
    slope_norm ** 2,
    size=PATCH_SIZE,
    mode="nearest"
)

local_std = np.sqrt(
    np.maximum(local_sq_mean - local_mean ** 2, 0)
)

X = np.column_stack([
    local_mean.ravel(),
    local_std.ravel()
])

print("Features created:", X.shape)


print("4/4 Generating landslide probability map...")

probability = model.predict_proba(X)[:, 1]

probability = probability.reshape(slope.shape).astype(np.float32)

probability[~valid] = np.nan

profile.update(
    dtype="float32",
    count=1,
    nodata=np.nan,
    compress="deflate"
)

with rasterio.open(OUTPUT, "w", **profile) as dst:
    dst.write(probability, 1)


print()
print("==============================")
print("IMAGE R6 PREDICTION COMPLETE")
print("==============================")
print("Output:", OUTPUT)
print("Probability range:",
      float(np.nanmin(probability)),
      "to",
      float(np.nanmax(probability)))
print("Model status: PROTOTYPE_NOT_VALIDATED")
print("Data source: REAL_MIZORAM_RASTER")
