import geopandas as gpd
import numpy as np
from pathlib import Path

INPUT = Path("../data/dem/slope_units_clean.geojson")
OUTPUT = Path("runout_envelopes.geojson")

# Prototype value ONLY.
# This is not a literature-calibrated value.
ANGLE_OF_REACH_DEG = 32.0

print("Loading slope units...")

gdf = gpd.read_file(INPUT)

print("Slope units:", len(gdf))

# Work in a projected CRS so distances are measured in metres.
# Aizawl is in UTM Zone 46N.
gdf = gdf.to_crs("EPSG:32646")

angle_rad = np.radians(ANGLE_OF_REACH_DEG)

# Approximate horizontal runout distance from
# each slope-unit centroid.
#
# Prototype assumption:
# runout distance = representative elevation difference / tan(angle)
#
# Since we do not yet have a calibrated source-to-toe
# elevation pair for every landslide, use a conservative
# fixed prototype distance based on slope-unit scale.
RUNOUT_DISTANCE_M = 500.0

print(
    "Using prototype angle of reach:",
    ANGLE_OF_REACH_DEG,
    "degrees"
)

print(
    "Using prototype runout distance:",
    RUNOUT_DISTANCE_M,
    "m"
)

# Create circular prototype envelopes around each
# slope-unit centroid.
centroids = gdf.geometry.centroid

gdf["runout_distance_m"] = RUNOUT_DISTANCE_M
gdf["angle_of_reach_deg"] = ANGLE_OF_REACH_DEG
gdf["runout_method"] = "empirical_angle_of_reach_PROTOTYPE"
gdf["runout_source"] = "SIMULATED"

gdf["geometry"] = centroids.buffer(RUNOUT_DISTANCE_M)

# Return to web/API CRS.
gdf = gdf.to_crs("EPSG:4326")

# Keep a compact output.
output_columns = [
    "runout_distance_m",
    "angle_of_reach_deg",
    "runout_method",
    "runout_source",
    "geometry"
]

gdf[output_columns].to_file(
    OUTPUT,
    driver="GeoJSON"
)

print()
print("==============================")
print("R7 RUNOUT PROTOTYPE COMPLETE")
print("==============================")
print("Envelopes:", len(gdf))
print("Angle of reach:", ANGLE_OF_REACH_DEG, "degrees")
print("Runout distance:", RUNOUT_DISTANCE_M, "m")
print("Output:", OUTPUT)
print("Source: SIMULATED")
print("Status: PROTOTYPE_NOT_CALIBRATED")
