import numpy as np
import rasterio
import joblib

MODEL = "landslide_rf_event5.joblib"
RASTER = "data/mizoram_extracted/Mizoram/feature images/13-06-2021/after/indicies/slope.tif"
OUTPUT = "event5_landslide_probability.tif"

model = joblib.load(MODEL)

with rasterio.open(RASTER) as src:
    image = src.read(1).astype("float32")
    profile = src.profile.copy()

valid = np.isfinite(image)

# Same feature representation used during training
features = np.column_stack([
    image.ravel(),
    np.zeros(image.size),
    image.ravel(),
    image.ravel(),
    image.ravel(),
    image.ravel(),
    image.ravel(),
])

features[~np.isfinite(features)] = 0

probability = model.predict_proba(features)[:, 1]
probability = probability.reshape(image.shape)

profile.update(
    dtype="float32",
    count=1,
    compress="lzw"
)

with rasterio.open(OUTPUT, "w", **profile) as dst:
    dst.write(probability.astype("float32"), 1)

print("PREDICTION COMPLETE")
print("Output:", OUTPUT)
print("Min probability:", probability.min())
print("Max probability:", probability.max())
print("Mean probability:", probability.mean())
