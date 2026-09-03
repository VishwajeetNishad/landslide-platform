-- 001_extensions.sql -- database extensions.
--
-- PostGIS is what makes this a spatial database rather than a database that
-- happens to hold coordinates. Everything downstream depends on it:
-- GEOMETRY(POLYGON, 4326) columns, GiST indexes, ST_Intersection for
-- exposure, ST_Transform for metric lengths, ST_AsGeoJSON for the API.
--
-- IF NOT EXISTS because the postgis/postgis Docker image already creates
-- the extension in the default database. This file exists so that a fresh
-- database, or a differently named one, still ends up correct.

CREATE EXTENSION IF NOT EXISTS postgis;
