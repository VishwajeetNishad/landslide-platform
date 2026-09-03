-- schema_constraints_test.sql -- throwaway verification for V4.2.
--
-- Runs inside a transaction and ROLLBACKs at the end, so it leaves nothing
-- behind. Every "must be rejected" case is a mistake a reasonable person
-- would actually make.

BEGIN;

CREATE FUNCTION t_reject(label text, sql text) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
    BEGIN
        EXECUTE sql;
        RAISE WARNING 'FAIL   % -- WAS ACCEPTED, must be rejected', label;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'PASS   % -> %', label, left(SQLERRM, 62);
    END;
END $fn$;

CREATE FUNCTION t_accept(label text, sql text) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
    BEGIN
        EXECUTE sql;
        RAISE NOTICE 'PASS   % (accepted, as it should be)', label;
    EXCEPTION WHEN others THEN
        RAISE WARNING 'FAIL   % -- WAS REJECTED: %', label, left(SQLERRM, 50);
    END;
END $fn$;

-- ---------- setup: the happy path must work first ----------
INSERT INTO app_user (id, email, full_name, role, assigned_districts)
VALUES (901, 'officer@example.gov.in', 'D. Officer (test)', 'DISTRICT_ADMIN', '{aizawl}');

INSERT INTO slope_unit (id, district_id, geom, centroid, area_ha, mean_slope_deg,
                        susceptibility_score, geological_province, source, is_mock)
VALUES ('TEST-1142', 'aizawl',
        ST_GeomFromText('POLYGON((92.7180 23.7290, 92.7212 23.7288, 92.7224 23.7266, 92.7208 23.7248, 92.7178 23.7252, 92.7166 23.7272, 92.7180 23.7290))', 4326),
        ST_Centroid(ST_GeomFromText('POLYGON((92.7180 23.7290, 92.7212 23.7288, 92.7224 23.7266, 92.7208 23.7248, 92.7178 23.7252, 92.7166 23.7272, 92.7180 23.7290))', 4326)),
        8.4, 34.2, 0.78, 'INDO_BURMAN', 'V4.2 constraint test', true);

INSERT INTO forecast_run (id, run_ts, input_cutoff_ts, model_version, is_demo_data)
VALUES (901, '2026-09-03T10:00:00+05:30', '2026-09-03T09:00:00+05:30', 'test-v0', true);

INSERT INTO prediction (id, forecast_run_id, slope_unit_id, valid_from, valid_to,
                        probability, confidence_lower, confidence_upper)
VALUES (901, 901, 'TEST-1142', '2026-09-03T20:00:00+05:30', '2026-09-04T08:00:00+05:30',
        0.72, 0.58, 0.84);

\echo ''
\echo '===== MUST BE REJECTED ====='

-- honesty of the hindcast
SELECT t_reject('forecast_run: cutoff AFTER run (temporal leakage)',
 $q$INSERT INTO forecast_run (run_ts, input_cutoff_ts, model_version, is_demo_data)
    VALUES ('2026-09-03T10:00:00+05:30', '2026-09-04T10:00:00+05:30', 'leaky', true)$q$);

-- the model's number
SELECT t_reject('prediction: probability 1.5',
 $q$INSERT INTO prediction (forecast_run_id, slope_unit_id, valid_from, valid_to, probability)
    VALUES (901, 'TEST-1142', '2026-09-05T00:00:00Z', '2026-09-05T12:00:00Z', 1.5)$q$);
SELECT t_reject('prediction: probability 72 (percentage bug)',
 $q$INSERT INTO prediction (forecast_run_id, slope_unit_id, valid_from, valid_to, probability)
    VALUES (901, 'TEST-1142', '2026-09-06T00:00:00Z', '2026-09-06T12:00:00Z', 72)$q$);
SELECT t_reject('prediction: inverted confidence band (0.8 .. 0.5)',
 $q$INSERT INTO prediction (forecast_run_id, slope_unit_id, valid_from, valid_to,
        probability, confidence_lower, confidence_upper)
    VALUES (901, 'TEST-1142', '2026-09-07T00:00:00Z', '2026-09-07T12:00:00Z', 0.7, 0.8, 0.5)$q$);
SELECT t_reject('prediction: band does not contain its own estimate',
 $q$INSERT INTO prediction (forecast_run_id, slope_unit_id, valid_from, valid_to,
        probability, confidence_lower, confidence_upper)
    VALUES (901, 'TEST-1142', '2026-09-08T00:00:00Z', '2026-09-08T12:00:00Z', 0.9, 0.1, 0.5)$q$);
SELECT t_reject('prediction: valid_to before valid_from',
 $q$INSERT INTO prediction (forecast_run_id, slope_unit_id, valid_from, valid_to, probability)
    VALUES (901, 'TEST-1142', '2026-09-09T12:00:00Z', '2026-09-09T00:00:00Z', 0.5)$q$);
SELECT t_reject('prediction: risk_level CRITICAL (not in the enum)',
 $q$UPDATE prediction SET risk_level = 'CRITICAL' WHERE id = 901$q$);

-- nothing self-confirms
SELECT t_reject('prediction: CONFIRMED with no human verifier',
 $q$UPDATE prediction SET verification_status = 'CONFIRMED' WHERE id = 901$q$);
SELECT t_reject('prediction: CONFIRMED with a verifier but no timestamp',
 $q$UPDATE prediction SET verification_status = 'CONFIRMED', verified_by = 901 WHERE id = 901$q$);

-- integrity
SELECT t_reject('prediction: duplicate (run, slope unit)',
 $q$INSERT INTO prediction (forecast_run_id, slope_unit_id, valid_from, valid_to, probability)
    VALUES (901, 'TEST-1142', '2026-09-03T20:00:00+05:30', '2026-09-04T08:00:00+05:30', 0.5)$q$);
SELECT t_reject('prediction: orphan slope_unit_id',
 $q$INSERT INTO prediction (forecast_run_id, slope_unit_id, valid_from, valid_to, probability)
    VALUES (901, 'NO-SUCH-UNIT', '2026-09-10T00:00:00Z', '2026-09-10T12:00:00Z', 0.5)$q$);

-- every physical parameter is attributable
SELECT t_reject('runout: NULL source_citation',
 $q$INSERT INTO runout_envelope (prediction_id, geom, method, source_citation)
    VALUES (901, ST_GeomFromText('POLYGON((92.71 23.72, 92.72 23.72, 92.72 23.73, 92.71 23.73, 92.71 23.72))', 4326),
            'empirical_angle_of_reach', NULL)$q$);
SELECT t_reject('runout: blank source_citation (NOT NULL is not enough)',
 $q$INSERT INTO runout_envelope (prediction_id, geom, method, source_citation)
    VALUES (901, ST_GeomFromText('POLYGON((92.71 23.72, 92.72 23.72, 92.72 23.73, 92.71 23.73, 92.71 23.72))', 4326),
            'empirical_angle_of_reach', '   ')$q$);

-- no population figure without its assumption
SELECT t_reject('exposure: population 120 with no source',
 $q$INSERT INTO exposure (prediction_id, buildings_count, population_estimate)
    VALUES (901, 17, 120)$q$);
SELECT t_reject('exposure: negative building count',
 $q$INSERT INTO exposure (prediction_id, buildings_count) VALUES (901, -1)$q$);

-- the authorisation gate
SELECT t_reject('alert: DISPATCHED with no authoriser  <-- THE GATE',
 $q$INSERT INTO alert (prediction_id, status, dispatched_at)
    VALUES (901, 'DISPATCHED', now())$q$);
SELECT t_reject('alert: DISPATCHED with an authoriser but no dispatch time',
 $q$INSERT INTO alert (prediction_id, status, authorised_by, authorised_at)
    VALUES (901, 'DISPATCHED', 901, now())$q$);
SELECT t_reject('alert: authoriser recorded with no timestamp',
 $q$INSERT INTO alert (prediction_id, status, authorised_by)
    VALUES (901, 'AUTHORISED', 901)$q$);
SELECT t_reject('alert: REJECTED with no reason given',
 $q$INSERT INTO alert (prediction_id, status, rejected_by, rejected_at)
    VALUES (901, 'REJECTED', 901, now())$q$);

-- provenance and CRS
SELECT t_reject('slope_unit: blank source',
 $q$INSERT INTO slope_unit (id, district_id, geom, centroid, area_ha, source, is_mock)
    VALUES ('TEST-BLANK', 'aizawl',
            ST_GeomFromText('POLYGON((92.71 23.72, 92.72 23.72, 92.72 23.73, 92.71 23.72))', 4326),
            ST_GeomFromText('POINT(92.715 23.725)', 4326), 1.0, '', true)$q$);
SELECT t_reject('slope_unit: geometry in the wrong SRID (32646, not 4326)',
 $q$INSERT INTO slope_unit (id, district_id, geom, centroid, area_ha, source, is_mock)
    VALUES ('TEST-SRID', 'aizawl',
            ST_Transform(ST_GeomFromText('POLYGON((92.71 23.72, 92.72 23.72, 92.72 23.73, 92.71 23.72))', 4326), 32646),
            ST_GeomFromText('POINT(92.715 23.725)', 4326), 1.0, 'srid test', true)$q$);

-- the audit log is append-only
INSERT INTO audit_log (actor_id, actor_label, action, entity, entity_id)
VALUES (901, 'D. Officer (test)', 'ALERT_AUTHORISED', 'alert', '901');

SELECT t_reject('audit_log: UPDATE',
 $q$UPDATE audit_log SET action = 'something else' WHERE entity_id = '901'$q$);
SELECT t_reject('audit_log: DELETE of a matching row',
 $q$DELETE FROM audit_log WHERE entity_id = '901'$q$);
SELECT t_reject('audit_log: DELETE matching NOTHING (statement-level trigger)',
 $q$DELETE FROM audit_log WHERE id = 999999999$q$);
SELECT t_reject('audit_log: TRUNCATE (bypasses DELETE triggers)',
 $q$TRUNCATE audit_log$q$);

\echo ''
\echo '===== MUST BE ACCEPTED ====='

SELECT t_accept('prediction: risk_level NULL (exposure not yet computed)',
 $q$SELECT 1 FROM prediction WHERE id = 901 AND risk_level IS NULL$q$);
SELECT t_accept('AZ-1088 case: population 0 with no source needed',
 $q$INSERT INTO exposure (prediction_id, buildings_count, population_estimate)
    VALUES (901, 0, 0)$q$);
SELECT t_accept('prediction: CONFIRMED with a named verifier and a timestamp',
 $q$UPDATE prediction SET verification_status = 'CONFIRMED', verified_by = 901,
        verified_at = now() WHERE id = 901$q$);
SELECT t_accept('prediction: risk LOW even though probability is 0.95',
 $q$UPDATE prediction SET probability = 0.95, confidence_lower = 0.88,
        confidence_upper = 0.98, risk_level = 'LOW' WHERE id = 901$q$);
SELECT t_accept('alert: DRAFT with no authoriser (a machine may draft)',
 $q$INSERT INTO alert (id, prediction_id, status) VALUES (902, 901, 'DRAFT')$q$);
SELECT t_accept('alert: DISPATCHED once a named human authorised it',
 $q$UPDATE alert SET status = 'DISPATCHED', authorised_by = 901,
        authorised_at = now(), dispatched_at = now() WHERE id = 902$q$);
SELECT t_accept('audit_log: INSERT (appending is always allowed)',
 $q$INSERT INTO audit_log (actor_id, actor_label, action, entity, entity_id)
    VALUES (901, 'D. Officer (test)', 'ALERT_DISPATCHED', 'alert', '902')$q$);

ROLLBACK;
