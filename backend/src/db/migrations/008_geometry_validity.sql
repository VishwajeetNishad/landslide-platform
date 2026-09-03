-- 008_geometry_validity.sql -- refuse geometry that is not valid.
--
-- WHY THIS EXISTS
--
-- GEOMETRY(POLYGON, 4326) checks the TYPE and the SRID. It does not check
-- that the polygon is valid. V7 found this by accident: a runout envelope
-- posted with a three-position, unclosed ring was accepted and stored as
--
--     POLYGON((92.74 23.75, 92.745 23.75, 92.745 23.746))
--     ST_IsValid = false, ST_IsClosed(ST_ExteriorRing(...)) = false
--
-- and the endpoint answered 201. Nothing in the stack objected.
--
-- WHY THAT IS DANGEROUS RATHER THAN UNTIDY
--
-- The runout envelope is the input to the exposure intersection. An
-- invalid polygon does not make ST_Intersection raise an error -- it
-- returns an empty geometry, or a result GEOS computed from a self-
-- crossing ring that nobody would recognise. Either way the buildings and
-- roads under the slope come out as zero, and the risk step then reads
-- zero exposure and answers LOW.
--
-- So the failure chain is: a malformed polygon from the model, silently
-- stored, produces a confident LOW on a populated hillside. That is the
-- exact failure this project is built to prevent, and it arrives with no
-- error anywhere in the log.
--
-- WHY A CHECK CONSTRAINT AND NOT VALIDATION IN THE ROUTE
--
-- The route does validate now, but the route is not the only writer: the
-- slope unit loader writes too, R7 will write runout envelopes, and any
-- one of us can open psql. A constraint is the only place a rule applies
-- to every writer including a future one. Same reasoning as migration
-- 004's verification constraint: if I write a bug in a handler, the
-- database still refuses.
--
-- ST_IsValid is not cheap on large geometry, but these are hillslope and
-- runout polygons of a few dozen positions, written once per forecast
-- run. The cost is irrelevant at this size.

-- ============================================================
-- runout_envelope
-- ============================================================
-- ST_IsValid covers the unclosed ring as well as self-intersection: an
-- unclosed exterior ring is invalid by the OGC definition, which is why
-- one constraint is enough here.
ALTER TABLE runout_envelope ADD CONSTRAINT runout_geom_is_valid
    CHECK (ST_IsValid(geom));

-- A ring needs 4 positions to close a triangle (the first repeated as the
-- last). Three positions cannot be a polygon at all. ST_IsValid already
-- refuses it, but this constraint names the actual mistake in the error
-- message, and the mistake -- forgetting to repeat the first position --
-- is the common one when a polygon is built in a loop.
ALTER TABLE runout_envelope ADD CONSTRAINT runout_geom_ring_has_4_positions
    CHECK (ST_NPoints(geom) >= 4);

-- ============================================================
-- slope_unit
-- ============================================================
-- The same hole, in the table that everything else references. It has not
-- been hit because the mock file happens to contain closed, valid rings,
-- and because ST_Area on an invalid polygon returns a number rather than
-- failing -- so a self-intersecting slope unit would have produced a
-- plausible area_ha and a polygon the map would draw with a bowtie in it.
ALTER TABLE slope_unit ADD CONSTRAINT slope_unit_geom_is_valid
    CHECK (ST_IsValid(geom));

ALTER TABLE slope_unit ADD CONSTRAINT slope_unit_geom_ring_has_4_positions
    CHECK (ST_NPoints(geom) >= 4);

-- The centroid must lie inside its own polygon.
--
-- The loader derives it with ST_Centroid, so this holds today by
-- construction. It is worth constraining anyway: the column exists so the
-- map can put a label or a pin on a slope unit, and a centroid that
-- belongs to a different polygon would put the pin on the wrong hillside
-- while both values looked reasonable on their own. For a concave
-- hillslope ST_Centroid can fall outside the polygon, so this uses
-- ST_DWithin against the geometry rather than ST_Contains -- close enough
-- to be the same place, far from being a different slope.
ALTER TABLE slope_unit ADD CONSTRAINT slope_unit_centroid_belongs_to_geom
    CHECK (ST_DWithin(centroid::geography, geom::geography, 500));
