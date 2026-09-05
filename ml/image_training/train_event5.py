import geopandas as gpd
import rasterio
from rasterio.features import rasterize
import numpy as np
from pathlib import Path

SHAPE = "data/event_annotations/event5/shapefiles/geometry_Polygon.shp"
RASTER = "data/mizoram_extracted/Mizoram/feature images/13-06-2021/after/indicies/slope.tif"

OUT = Path("training_data")
OUT.mkdir(exist_ok=True)

PATCH = 32

gdf = gpd.read_file(SHAPE)

with rasterio.open(RASTER) as src:
    image = src.read(1).astype("float32")

    mask = rasterize(
        [(geom, 1) for geom in gdf.geometry],
        out_shape=(src.height, src.width),
        transform=src.transform,
        fill=0,
        dtype="uint8"
    )

# Replace invalid values
image[~np.isfinite(image)] = np.nan

# Normalize image
valid = image[np.isfinite(image)]

lo, hi = np.percentile(valid, [2, 98])
image = np.clip(image, lo, hi)
image = (image - lo) / (hi - lo + 1e-8)
image = np.nan_to_num(image)

X = []
Y = []

rng = np.random.default_rng(42)

# Positive patches
positive_pixels = np.argwhere(mask == 1)

for _ in range(500):
    y, x = positive_pixels[rng.integers(len(positive_pixels))]

    y0 = y - PATCH // 2
    x0 = x - PATCH // 2

    if y0 < 0 or x0 < 0:
        continue
    if y0 + PATCH > image.shape[0] or x0 + PATCH > image.shape[1]:
        continue

    patch = image[y0:y0+PATCH, x0:x0+PATCH]

    # Keep patches containing landslide pixels
    patch_mask = mask[y0:y0+PATCH, x0:x0+PATCH]

    if patch_mask.sum() > 0:
        X.append(patch)
        Y.append(1)

# Negative patches
for _ in range(500):
    y = rng.integers(PATCH//2, image.shape[0] - PATCH//2)
    x = rng.integers(PATCH//2, image.shape[1] - PATCH//2)

    y0 = y - PATCH // 2
    x0 = x - PATCH // 2

    patch = image[y0:y0+PATCH, x0:x0+PATCH]
    patch_mask = mask[y0:y0+PATCH, x0:x0+PATCH]

    if patch_mask.sum() == 0:
        X.append(patch)
        Y.append(0)

X = np.array(X, dtype="float32")
Y = np.array(Y, dtype="int64")

np.save(OUT / "X.npy", X)
np.save(OUT / "y.npy", Y)

print("================================")
print("TRAINING DATA CREATED")
print("================================")
print("X shape:", X.shape)
print("y shape:", Y.shape)
print("Positive:", int((Y == 1).sum()))
print("Negative:", int((Y == 0).sum()))
print("Saved to:", OUT)
