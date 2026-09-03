-- 007_slope_unit_ward.sql -- the human-readable place name for a slope unit.
--
-- WHY THIS IS A NEW FILE AND NOT AN EDIT TO 003
--
-- 003 is already applied, and the migration runner stores its checksum. To
-- add a column, the honest move is a new numbered file: the database's
-- history then matches the repo's history, and anyone who has already run
-- 003 gets this change too. Editing 003 would have worked on my machine and
-- broken on Rudra's and Riya's. This is the checksum guard doing its job.
--
-- WHY THE COLUMN IS NEEDED
--
-- 'AZ-1142' is our identifier, not anybody else's. A DDMA officer reading a
-- decision card needs to know the slope is in Melthum. Without a place name
-- the operator has to translate an internal id into a location under time
-- pressure, which is where mistakes get made.
--
-- Nullable on purpose: real slope units come from a DEM, and a
-- DEM-delineated hillslope does not necessarily sit inside exactly one named
-- ward. NULL means "not attributed to a ward", which is a truthful state.
-- A NOT NULL column would push whoever loads that data into writing
-- 'Unknown', and 'Unknown' would then be rendered on the map as if it were
-- a place.
ALTER TABLE slope_unit ADD COLUMN ward_name TEXT;

-- Blank is not a place name either. Same reasoning as source_citation in
-- 004: NOT NULL alone would accept the empty string.
ALTER TABLE slope_unit ADD CONSTRAINT slope_unit_ward_name_not_blank
    CHECK (ward_name IS NULL OR btrim(ward_name) <> '');
