import rasterio
import numpy as np

DEM = "../data/dem/output_hh.tif"

SLOPE_OUTPUT = "../data/dem/slope.tif"
ASPECT_OUTPUT = "../data/dem/aspect.tif"
CURVATURE_OUTPUT = "../data/dem/curvature.tif"

with rasterio.open(DEM) as src:
    elevation = src.read(1).astype("float32")
    profile = src.profile
    bounds = src.bounds
    xres, yres = src.res

    lat = (bounds.top + bounds.bottom) / 2

    meters_per_degree_lat = 111320
    meters_per_degree_lon = (
        111320 * np.cos(np.radians(lat))
    )

    dx = xres * meters_per_degree_lon
    dy = yres * meters_per_degree_lat

dz_dy, dz_dx = np.gradient(elevation, dy, dx)

slope = np.degrees(
    np.arctan(
        np.sqrt(dz_dx**2 + dz_dy**2)
    )
)

aspect = (
    np.degrees(
        np.arctan2(-dz_dx, dz_dy)
    ) + 360
) % 360

d2z_dx2 = np.gradient(dz_dx, dx, axis=1)
d2z_dy2 = np.gradient(dz_dy, dy, axis=0)

curvature = d2z_dx2 + d2z_dy2

profile.update(
    dtype="float32",
    count=1,
    compress="lzw",
    nodata=-9999
)

with rasterio.open(SLOPE_OUTPUT, "w", **profile) as dst:
    dst.write(slope.astype("float32"), 1)

with rasterio.open(ASPECT_OUTPUT, "w", **profile) as dst:
    dst.write(aspect.astype("float32"), 1)

with rasterio.open(CURVATURE_OUTPUT, "w", **profile) as dst:
    dst.write(curvature.astype("float32"), 1)

print("Slope created:", SLOPE_OUTPUT)
print("Slope range:", float(np.nanmin(slope)), "to", float(np.nanmax(slope)))

print("Aspect created:", ASPECT_OUTPUT)
print("Aspect range:", float(np.nanmin(aspect)), "to", float(np.nanmax(aspect)))

print("Curvature created:", CURVATURE_OUTPUT)
print("Curvature range:", float(np.nanmin(curvature)), "to", float(np.nanmax(curvature)))
