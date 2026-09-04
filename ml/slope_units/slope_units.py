from whitebox.whitebox_tools import WhiteboxTools
import geopandas as gpd

BASE = "../data/dem"

dem = f"{BASE}/output_hh.tif"
filled_dem = f"{BASE}/dem_filled.tif"
d8_pointer = f"{BASE}/d8_pointer.tif"
flow_accum = f"{BASE}/flow_accumulation.tif"
streams = f"{BASE}/streams.tif"
hillslopes = f"{BASE}/hillslopes.tif"
shp = f"{BASE}/slope_units.shp"
geojson = f"{BASE}/slope_units_clean.geojson"

wbt = WhiteboxTools()

print("1/5 Filling depressions...")
wbt.fill_depressions(
    dem=dem,
    output=filled_dem,
    fix_flats=True
)

print("2/5 Creating D8 pointer...")
wbt.d8_pointer(
    dem=filled_dem,
    output=d8_pointer
)

print("3/5 Creating flow accumulation...")
wbt.d8_flow_accumulation(
    i=d8_pointer,
    output=flow_accum,
    pntr=True
)

print("4/5 Extracting streams...")
wbt.extract_streams(
    flow_accum=flow_accum,
    output=streams,
    threshold=100,
    zero_background=True
)

print("5/5 Creating hillslopes...")
wbt.hillslopes(
    d8_pntr=d8_pointer,
    streams=streams,
    output=hillslopes
)

print("Converting hillslopes to polygons...")
wbt.raster_to_vector_polygons(
    i=hillslopes,
    output=shp
)

print("Cleaning polygon geometries...")
gdf = gpd.read_file(shp)
gdf.geometry = gdf.geometry.make_valid()
gdf = gdf[~gdf.geometry.is_empty].copy()
gdf = gdf.to_crs("EPSG:4326")
gdf.to_file(geojson, driver="GeoJSON")

print("\nR3 COMPLETE")
print("Slope units:", len(gdf))
print("CRS:", gdf.crs)
print("Invalid geometries:", (~gdf.geometry.is_valid).sum())
print("Output:", geojson)
