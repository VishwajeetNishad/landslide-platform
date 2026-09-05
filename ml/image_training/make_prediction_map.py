import numpy as np
import rasterio
import joblib
from scipy.ndimage import uniform_filter

MODEL = "landslide_rf_correct.joblib"
RASTER = "data/mizoram_extracted/Mizoram/feature images/13-06-2021/after/indicies/slope.tif"
OUTPUT = "event5_landslide_probability_correct.tif"

model = joblib.load(MODEL)

with rasterio.open(RASTER) as src:
    image = src.read(1).astype("float32")
    profile = src.profile.copy()

# Handle invalid values
valid = np.isfinite(image)

if not valid.any():
    raise ValueError("Raster contains no valid pixels.")

fill_value = np.nanmedian(image[valid])
image[~valid] = fill_value

# 32x32 neighborhood statistics — SAME concept as training
size = 32

local_mean = uniform_filter(image, size=size, mode="nearest")
local_sq_mean = uniform_filter(image**2, size=size, mode="nearest")
local_std = np.sqrt(np.maximum(local_sq_mean - local_mean**2, 0))

features = np.column_stack([
    local_mean.ravel(),
    local_std.ravel()
])

probability = model.predict_proba(features)[:, 1]
probability = probability.reshape(image.shape)

# Restore NoData pixels
probability[~valid] = 0

profile.update(
    dtype="float32",
    count=1,
    compress="lzw"
)

with rasterio.open(OUTPUT, "w", **profile) as dst:
    dst.write(probability.astype("float32"), 1)

print("================================")
print("PREDICTION MAP CREATED")
print("================================")
print("Output:", OUTPUT)
print("Shape:", probability.shape)
print("Min:", probability.min())
print("Max:", probability.max())
print("Mean:", probability.mean())
