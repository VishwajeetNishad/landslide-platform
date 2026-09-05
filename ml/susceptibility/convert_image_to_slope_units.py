import geopandas as gpd
import rasterio
import rasterio.mask
import numpy as np
from pathlib import Path

SLOPE_UNITS = Path("../data/dem/slope_units_clean.geojson")
PROBABILITY = Path("image_susceptibility_probability.tif")
OUTPUT = Path("image_susceptibility_predictions.geojson")

print("1/3 Loading slope units...")
gdf = gpd.read_file(SLOPE_UNITS)

print("Slope units:", len(gdf))

print("2/3 Calculating image-based susceptibility...")

scores = []

with rasterio.open(PROBABILITY) as src:

    gdf = gdf.to_crs(src.crs)

    for geom in gdf.geometry:

        try:
            data, _ = rasterio.mask.mask(
                src,
                [geom],
                crop=True,
                filled=False
            )

            arr = data[0]

            if np.ma.count(arr) == 0:
                scores.append(np.nan)
            else:
                scores.append(float(arr.mean()))

        except Exception:
            scores.append(np.nan)

gdf["susceptibility_score"] = scores
gdf["probability"] = scores

gdf["confidence_lower"] = np.clip(
    gdf["probability"] - 0.10,
    0,
    1
)

gdf["confidence_upper"] = np.clip(
    gdf["probability"] + 0.10,
    0,
    1
)

gdf["data_source"] = "REAL_MIZORAM_RASTER"
gdf["model_status"] = "PROTOTYPE_NOT_VALIDATED"

print("3/3 Saving image-based R6 output...")

gdf = gdf.to_crs("EPSG:4326")

gdf.to_file(
    OUTPUT,
    driver="GeoJSON"
)

valid = gdf["susceptibility_score"].notna().sum()

print()
print("==============================")
print("IMAGE R6 → SLOPE UNIT COMPLETE")
print("==============================")
print("Slope units:", len(gdf))
print("Valid image scores:", valid)
print("Output:", OUTPUT)
print("Data source: REAL_MIZORAM_RASTER")
print("Status: PROTOTYPE_NOT_VALIDATED")
