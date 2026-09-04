import geopandas as gpd
import pandas as pd
import numpy as np
import rasterio
import rasterio.mask
from pathlib import Path
from lightgbm import Booster

DEM_DIR = Path("../data/dem")

MODEL = Path("susceptibility_model.txt")
SLOPE_UNITS = DEM_DIR / "slope_units_clean.geojson"
SLOPE = DEM_DIR / "slope.tif"
CURVATURE = DEM_DIR / "curvature.tif"

SWI_FILE = Path("../tank/soil_water_index.csv")
RAIN_FILE = Path("../rainfall/rainfall_clean.csv")

OUTPUT = Path("susceptibility_predictions.geojson")


def zonal_mean(gdf, raster_path, column_name):
    values = []

    with rasterio.open(raster_path) as src:
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
                    values.append(np.nan)
                else:
                    values.append(float(arr.mean()))

            except Exception:
                values.append(np.nan)

    gdf[column_name] = values
    return gdf


print("1/6 Loading slope units...")

gdf = gpd.read_file(SLOPE_UNITS)

print("Slope units:", len(gdf))


print("2/6 Calculating terrain features...")

gdf = zonal_mean(
    gdf,
    SLOPE,
    "mean_slope_deg"
)

gdf = zonal_mean(
    gdf,
    CURVATURE,
    "mean_curvature"
)

print("Terrain features calculated.")


print("3/6 Loading SWI and rainfall...")

swi = pd.read_csv(SWI_FILE)
rain = pd.read_csv(RAIN_FILE)

latest_swi = float(swi.iloc[-1]["swi_mm"])
latest_date = str(swi.iloc[-1]["date"])
latest_rainfall = float(rain.iloc[-1]["rainfall_mm"])

print("Latest SWI:", latest_swi, "mm")
print("Latest rainfall:", latest_rainfall, "mm")


gdf["swi_mm"] = latest_swi
gdf["rainfall_24h_mm"] = latest_rainfall


print("4/6 Cleaning features...")

feature_columns = [
    "mean_slope_deg",
    "mean_curvature",
    "swi_mm",
    "rainfall_24h_mm"
]

gdf[feature_columns] = gdf[feature_columns].replace(
    [np.inf, -np.inf],
    np.nan
)

before = len(gdf)

gdf = gdf.dropna(
    subset=feature_columns
).copy()

print("Removed units:", before - len(gdf))
print("Units for prediction:", len(gdf))


print("5/6 Loading LightGBM model...")

model = Booster(
    model_file=str(MODEL)
)

X = gdf[feature_columns]

print("Generating predictions...")

probability = model.predict(X)

gdf["susceptibility_score"] = probability
gdf["probability"] = probability


margin = 0.10

gdf["confidence_lower"] = np.clip(
    gdf["probability"] - margin,
    0,
    1
)

gdf["confidence_upper"] = np.clip(
    gdf["probability"] + margin,
    0,
    1
)


gdf["data_source"] = "SIMULATED"
gdf["model_status"] = "PROTOTYPE_NOT_VALIDATED"
gdf["input_cutoff_ts"] = latest_date


print("6/6 Saving predictions...")

gdf = gdf.to_crs("EPSG:4326")

gdf.to_file(
    OUTPUT,
    driver="GeoJSON"
)


print()
print("==============================")
print("R6 PREDICTION COMPLETE")
print("==============================")

print("Predicted slope units:", len(gdf))

print(
    "Susceptibility range:",
    round(float(gdf["susceptibility_score"].min()), 3),
    "to",
    round(float(gdf["susceptibility_score"].max()), 3)
)

print("Output:", OUTPUT)
print("Data source: SIMULATED")
print("Model status: PROTOTYPE_NOT_VALIDATED")
