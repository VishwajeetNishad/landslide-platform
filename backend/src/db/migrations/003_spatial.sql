-- 003_spatial.sql -- the spatial substrate: slope units.
--
-- A slope unit is the unit of analysis for this whole system: a single
-- hillslope, bounded by drainage divides and channels. Predictions,
-- exposure and alerts all hang off one of these, never off a raster pixel.

CREATE TABLE slope_unit (
    id          TEXT PRIMARY KEY,                       -- e.g. 'AZ-1142'
    district_id TEXT NOT NULL REFERENCES district(id),

    -- SRID 4326 (WGS 84 lat/lon) is the STORAGE crs, and it is fixed in the
    -- column type so a wrongly projected geometry is rejected by the
    -- database rather than silently accepted.
    --
    -- 4326 is an angular system: its units are degrees, not metres. Any
    -- length or area must therefore be measured after ST_Transform to
    -- EPSG:32646 (UTM 46N, correct for Mizoram). This is not a style
    -- preference -- measured in 4326, a road segment that is really 1019.2 m
    -- long comes out as 0.01, and PostGIS raises no error at all. That was
    -- verified by hand in V3 before this table existed.
    geom     GEOMETRY(POLYGON, 4326) NOT NULL,
    centroid GEOMETRY(POINT,   4326) NOT NULL,

    -- ---------- static terrain attributes ----------
    area_ha           DOUBLE PRECISION NOT NULL,
    mean_slope_deg    DOUBLE PRECISION,
    max_slope_deg     DOUBLE PRECISION,

    -- Aspect is stored as its sine and cosine, never as raw degrees.
    -- Degrees wrap: 359 and 1 are two degrees apart in reality but 358
    -- apart numerically, so any model or average over raw degrees is wrong
    -- near north. sin/cos have no wrap.
    aspect_sin        DOUBLE PRECISION,
    aspect_cos        DOUBLE PRECISION,

    relief_m          DOUBLE PRECISION,
    profile_curvature DOUBLE PRECISION,
    twi               DOUBLE PRECISION,   -- topographic wetness index

    lithology_class     TEXT,
    landcover_class     TEXT,
    geological_province TEXT,

    dist_to_road_m        DOUBLE PRECISION,
    has_road_cut          BOOLEAN NOT NULL DEFAULT FALSE,
    mean_annual_precip_mm DOUBLE PRECISION,   -- for rainfall normalisation

    -- Susceptibility: how inherently dangerous this slope is. Changes over
    -- years, not hours. In this prototype it is an openly labelled
    -- expert-weighted index, NOT a trained model -- we have no validated
    -- landslide inventory to train or validate against, so a trained model
    -- and its AUC would be fiction. The value is stored here; the fact that
    -- it is an index rather than a model output is stated in the API
    -- response and on the slide.
    susceptibility_score DOUBLE PRECISION,

    seismic_weakening    DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- ---------- provenance ----------
    -- Where this polygon came from, and whether it is mock. This is per-row
    -- rather than a global switch on purpose: a global DEMO_MODE flag can be
    -- turned off while mock rows are still in the table, and then illustrative
    -- polygons would be presented as real slope units with no banner. A NOT
    -- NULL source means no geometry can enter this table anonymously.
    source     TEXT    NOT NULL,
    is_mock    BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT slope_unit_source_not_blank CHECK (btrim(source) <> ''),
    CONSTRAINT slope_unit_area_positive    CHECK (area_ha > 0),
    CONSTRAINT slope_unit_susceptibility_range CHECK (
        susceptibility_score IS NULL OR susceptibility_score BETWEEN 0 AND 1),
    CONSTRAINT slope_unit_slope_range CHECK (
        mean_slope_deg IS NULL OR mean_slope_deg BETWEEN 0 AND 90),
    CONSTRAINT slope_unit_geological_province CHECK (geological_province IS NULL
        OR geological_province IN ('HIMALAYAN', 'INDO_BURMAN', 'SHILLONG_PLATEAU'))
);

-- A GiST index is what makes spatial queries possible rather than merely
-- expressible. Without it, "which buildings fall inside this runout
-- envelope" compares every polygon against every building; with it,
-- Postgres discards almost everything using bounding boxes first.
-- Exposure intersection is the slowest query in this system, so this index
-- is not an optimisation to add later.
CREATE INDEX slope_unit_geom_idx     ON slope_unit USING GIST (geom);
CREATE INDEX slope_unit_centroid_idx ON slope_unit USING GIST (centroid);

-- The dashboard always filters by district, so this makes that cheap.
CREATE INDEX slope_unit_district_idx ON slope_unit (district_id);
