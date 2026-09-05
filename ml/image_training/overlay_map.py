import geopandas as gpd
import rasterio
import matplotlib.pyplot as plt

raster = "event5_probability_final.tif"
shp = "data/event_annotations/event5/shapefiles/geometry_Polygon.shp"

gdf = gpd.read_file(shp)

with rasterio.open(raster) as src:
    prob = src.read(1)
    bounds = src.bounds

fig, ax = plt.subplots(figsize=(10, 8))

ax.imshow(
    prob,
    extent=[bounds.left, bounds.right, bounds.bottom, bounds.top],
    origin="upper",
    cmap="hot",
    vmin=0,
    vmax=1
)

gdf.boundary.plot(
    ax=ax,
    linewidth=2
)

ax.set_title("Mizoram Landslide Probability — Prototype + Ground-Truth Polygon")
ax.set_xlabel("UTM Easting")
ax.set_ylabel("UTM Northing")

plt.tight_layout()
plt.savefig(
    "event5_prediction_with_landslide_overlay.png",
    dpi=200,
    bbox_inches="tight"
)

plt.close()

print("OVERLAY MAP CREATED")
print("event5_prediction_with_landslide_overlay.png")
