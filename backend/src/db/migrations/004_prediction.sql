-- 004_prediction.sql -- forecast runs, predictions, runout, exposure.
--
-- This is the migration that turns the project's argument into constraints.
-- Every CHECK below exists because the corresponding mistake is one a
-- reasonable person would make, and one that would be invisible afterwards.

-- ============================================================
-- forecast_run -- one row per time the model was run
-- ============================================================
CREATE TABLE forecast_run (
    id      BIGSERIAL   PRIMARY KEY,
    run_ts  TIMESTAMPTZ NOT NULL,     -- when the model ran

    -- THE MOST IMPORTANT COLUMN IN THIS TABLE.
    --
    -- input_cutoff_ts means: nothing recorded after this instant was used as
    -- input. It is what makes a hindcast honest. If we replay 3 September's
    -- landslide and quietly feed the model 4 September's rainfall, the
    -- accuracy comes out near-perfect and is entirely fictional. That is
    -- called temporal leakage, and it is the single most common reason
    -- landslide-prediction results are worthless.
    --
    -- Storing it is not enough on its own -- the constraint below is what
    -- makes it impossible to record a run that claims to have used data from
    -- after it ran.
    input_cutoff_ts TIMESTAMPTZ NOT NULL,

    model_version TEXT    NOT NULL,
    is_hindcast   BOOLEAN NOT NULL DEFAULT FALSE,

    -- Whether this run's numbers are illustrative. Per-run rather than a
    -- global flag, so a demo run and a real run can coexist in one database
    -- without either being mislabelled.
    is_demo_data BOOLEAN     NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT forecast_run_no_temporal_leakage CHECK (input_cutoff_ts <= run_ts),
    CONSTRAINT forecast_run_model_version_not_blank CHECK (btrim(model_version) <> '')
);

-- ============================================================
-- prediction -- one row per slope unit per forecast run
-- ============================================================
CREATE TABLE prediction (
    id              BIGSERIAL PRIMARY KEY,
    forecast_run_id BIGINT NOT NULL REFERENCES forecast_run(id) ON DELETE CASCADE,
    slope_unit_id   TEXT   NOT NULL REFERENCES slope_unit(id),

    valid_from TIMESTAMPTZ NOT NULL,
    valid_to   TIMESTAMPTZ NOT NULL,

    -- ---------- 1 of 3: what the MODEL says ----------
    susceptibility_score DOUBLE PRECISION,
    probability          DOUBLE PRECISION NOT NULL,
    confidence_lower     DOUBLE PRECISION,
    confidence_upper     DOUBLE PRECISION,

    -- ---------- 2 of 3: what the MODEL PLUS EXPOSURE says ----------
    -- risk_level = probability x consequence. It is a separate column and
    -- NOT a view over probability, because the two genuinely differ: slope
    -- AZ-1088 has probability 0.95 and risk LOW, because nothing is below
    -- it. Deriving risk from confidence would send teams to an empty
    -- hillside and leave the populated one unattended.
    --
    -- NULLABLE on purpose. Exposure cannot be computed until the prediction
    -- row exists (exposure references it), so a prediction is inserted with
    -- risk_level NULL and updated in the SAME transaction once exposure is
    -- known. NULL therefore means "exposure not yet computed", and the API
    -- must not present such a row as though its risk were known.
    risk_level TEXT,

    -- ---------- 3 of 3: what a HUMAN says ----------
    -- Set by a person, never by the system. The default is the whole point:
    -- an AI prediction is not a confirmed disaster.
    verification_status TEXT        NOT NULL DEFAULT 'PENDING_VERIFICATION',
    verified_by         BIGINT      REFERENCES app_user(id),
    verified_at         TIMESTAMPTZ,
    verification_note   TEXT,

    -- ---------- explanation and inputs ----------
    -- Kept as JSONB rather than as separate tables. For this prototype the
    -- tank state and rainfall are read back exactly as the model sent them,
    -- never queried across time, so a time-series table would add joins and
    -- migrations for no benefit. Separate rainfall / soil_moisture /
    -- tank_state tables are designed in docs/ARCHITECTURE.md and
    -- deliberately not built yet.
    tank_state          JSONB,   -- {s1_mm, s2_mm, s3_mm, swi_mm}
    rainfall            JSONB,   -- {observed_24h_mm, forecast_24h_mm, fraction_of_map}
    drivers             JSONB,   -- feature -> contribution
    counterfactual      TEXT,
    nearest_gauge_km    DOUBLE PRECISION,
    rainfall_confidence TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One prediction per slope unit per run. Without this, ingesting the
    -- same file twice would double every row and the map would show
    -- whichever copy the query happened to reach first.
    CONSTRAINT prediction_one_per_unit_per_run UNIQUE (forecast_run_id, slope_unit_id),

    -- A probability is between 0 and 1. A model that starts emitting
    -- percentages (72 instead of 0.72) is a bug that would otherwise show up
    -- as every slope being catastrophic.
    CONSTRAINT prediction_probability_range CHECK (probability BETWEEN 0 AND 1),
    CONSTRAINT prediction_susceptibility_range CHECK (
        susceptibility_score IS NULL OR susceptibility_score BETWEEN 0 AND 1),
    CONSTRAINT prediction_confidence_range CHECK (
        (confidence_lower IS NULL OR confidence_lower BETWEEN 0 AND 1) AND
        (confidence_upper IS NULL OR confidence_upper BETWEEN 0 AND 1)),

    -- An inverted band (lower > upper) is meaningless, and a band that does
    -- not contain its own point estimate is worse: it looks like honest
    -- uncertainty while being arithmetically impossible.
    CONSTRAINT prediction_confidence_band_ordered CHECK (
        confidence_lower IS NULL OR confidence_upper IS NULL
        OR confidence_lower <= confidence_upper),
    CONSTRAINT prediction_confidence_band_contains_estimate CHECK (
        (confidence_lower IS NULL OR confidence_lower <= probability) AND
        (confidence_upper IS NULL OR probability <= confidence_upper)),

    CONSTRAINT prediction_window_ordered CHECK (valid_to > valid_from),

    CONSTRAINT prediction_risk_level CHECK (
        risk_level IS NULL OR risk_level IN ('LOW', 'MEDIUM', 'HIGH')),

    CONSTRAINT prediction_verification_status CHECK (verification_status IN
        ('PENDING_VERIFICATION', 'CONFIRMED', 'FALSE_POSITIVE', 'NEEDS_REVIEW')),

    -- Nothing self-confirms. Moving off PENDING_VERIFICATION requires a
    -- named user and a timestamp, enforced here rather than trusted to the
    -- application: if I write a bug in the verification endpoint, the
    -- database still refuses.
    CONSTRAINT prediction_verification_needs_a_human CHECK (
        verification_status = 'PENDING_VERIFICATION'
        OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);

CREATE INDEX prediction_run_idx        ON prediction (forecast_run_id);
CREATE INDEX prediction_slope_unit_idx ON prediction (slope_unit_id);
-- The dashboard asks "what is currently in force", so it filters on the
-- validity window.
CREATE INDEX prediction_validity_idx   ON prediction (valid_from, valid_to);

-- ============================================================
-- runout_envelope -- where the debris could reach
-- ============================================================
-- Separate from prediction because it is optional (a prediction with no
-- runout is still a valid prediction) and because it needs its own GiST
-- index for the exposure intersection.
CREATE TABLE runout_envelope (
    prediction_id BIGINT PRIMARY KEY REFERENCES prediction(id) ON DELETE CASCADE,
    geom          GEOMETRY(POLYGON, 4326) NOT NULL,
    method        TEXT NOT NULL,      -- 'empirical_angle_of_reach'
    angle_of_reach_deg DOUBLE PRECISION,

    -- NOT NULL, and checked for blankness, because NOT NULL alone is
    -- satisfied by an empty string. Every physical parameter in this system
    -- must be attributable to a source: the angle of reach decides how far
    -- downhill we tell people the debris may travel, which decides who gets
    -- warned. A number like that without a citation does not enter the
    -- database.
    source_citation TEXT NOT NULL,

    CONSTRAINT runout_citation_not_blank CHECK (btrim(source_citation) <> ''),
    CONSTRAINT runout_angle_range CHECK (
        angle_of_reach_deg IS NULL OR angle_of_reach_deg BETWEEN 0 AND 90)
);

CREATE INDEX runout_envelope_geom_idx ON runout_envelope USING GIST (geom);

-- ============================================================
-- exposure -- who and what is potentially in the way
-- ============================================================
CREATE TABLE exposure (
    prediction_id BIGINT PRIMARY KEY REFERENCES prediction(id) ON DELETE CASCADE,

    buildings_count INTEGER,

    -- ALWAYS rendered as "estimated potentially exposed population", never
    -- as "N people affected". The wording is a project rule; the column is
    -- just an integer, so the rule is enforced by population_source being
    -- NOT NULL: the number cannot exist in the database without the
    -- assumption that produced it written down next to it.
    population_estimate INTEGER,
    population_source   TEXT,

    -- Lengths in METRES, computed in EPSG:32646, never in 4326.
    road_metres DOUBLE PRECISION,

    -- [{name, chainage_start_km, chainage_end_km, metres}]
    -- Chainage is distance along a road from its origin. That is how PWD
    -- engineers locate things -- far more actionable to them than a lat/lon.
    road_segments       JSONB NOT NULL DEFAULT '[]'::jsonb,
    critical_facilities JSONB NOT NULL DEFAULT '[]'::jsonb,

    is_estimate  BOOLEAN     NOT NULL DEFAULT TRUE,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT exposure_counts_not_negative CHECK (
        (buildings_count     IS NULL OR buildings_count     >= 0) AND
        (population_estimate IS NULL OR population_estimate >= 0) AND
        (road_metres         IS NULL OR road_metres         >= 0)),

    -- No population figure without its source. Zero is exempt: "nobody is
    -- exposed" is a finding, not an estimate, and AZ-1088 depends on being
    -- able to record exactly that.
    CONSTRAINT exposure_population_needs_a_source CHECK (
        population_estimate IS NULL OR population_estimate = 0
        OR (population_source IS NOT NULL AND btrim(population_source) <> '')),

    CONSTRAINT exposure_road_segments_is_array CHECK (
        jsonb_typeof(road_segments) = 'array'),
    CONSTRAINT exposure_critical_facilities_is_array CHECK (
        jsonb_typeof(critical_facilities) = 'array')
);
