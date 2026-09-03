-- 002_reference.sql -- reference tables that everything else points at.
--
-- Kept in its own migration because these two tables are referenced by
-- foreign keys from almost every later table, so they must exist first.

-- ============================================================
-- district
-- ============================================================
-- The pilot district is Aizawl, Mizoram. This table exists so that
-- slope_unit.district_id is a real foreign key rather than a free-text
-- field, and so that row-level scoping ("this officer may only see their
-- own district") has something to point at later.
CREATE TABLE district (
    id         TEXT PRIMARY KEY,              -- 'aizawl'
    name       TEXT NOT NULL,                 -- 'Aizawl'
    state      TEXT NOT NULL,                 -- 'Mizoram'

    -- Deliberately NULLABLE and deliberately left NULL for now.
    --
    -- We do not have an authoritative Aizawl district boundary, and we are
    -- not going to hand-draw one. A hand-drawn administrative boundary is a
    -- fabricated geographic coordinate, which this project does not do. The
    -- column is here so a real boundary can be loaded later with a
    -- citation; until then the honest value is NULL.
    geom       GEOMETRY(MULTIPOLYGON, 4326),

    boundary_source TEXT,                     -- citation, required if geom is set

    CONSTRAINT district_boundary_needs_a_source CHECK (
        geom IS NULL OR (boundary_source IS NOT NULL AND btrim(boundary_source) <> ''))
);

-- Aizawl is a real district of Mizoram; this is not invented data. Only the
-- identifier, name and state are asserted here -- no geometry, no numbers.
INSERT INTO district (id, name, state) VALUES ('aizawl', 'Aizawl', 'Mizoram')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- app_user
-- ============================================================
-- Needed now, even though authentication itself is a later step, because
-- two of this project's central guarantees are foreign keys into this
-- table: prediction.verified_by and alert.authorised_by. "A named human
-- did this" cannot be enforced without a table of named humans.
CREATE TABLE app_user (
    id        BIGSERIAL PRIMARY KEY,
    email     TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,     -- appears in the audit log and in CAP output
    role      TEXT NOT NULL,

    -- Row-level scoping: which districts this user may see. Empty array
    -- means none, which is the safe default -- a new user can see nothing
    -- until someone grants access.
    assigned_districts TEXT[] NOT NULL DEFAULT '{}',

    is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT app_user_role CHECK (role IN
        ('SUPER_ADMIN', 'DISTRICT_ADMIN', 'FIELD_OFFICER', 'CITIZEN')),
    CONSTRAINT app_user_name_not_blank CHECK (btrim(full_name) <> '')
);
