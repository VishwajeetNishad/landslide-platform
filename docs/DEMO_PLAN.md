# DEMO PLAN — presentation 5 September 2026

Today is **3 September**. Time remaining: this evening, all of 4 September, and
the morning of 5 September. Realistically **two days, three people**.

`docs/IMPLEMENTATION_STEPS.md` lists V0–V14, R1–R8 and F1–F8. Not all of that
fits in two days. This file decides **what gets built** and **what is presented
honestly as "designed, not built"**.

> Telling the judges "we deliberately did not build this, and here is why" is
> not a weakness. Building it halfway and claiming it works is.

---

## 1. The five things that must not break

The entire argument of the project rests on these. Everything else is decoration.

1. **Three separate values, kept separate** — `probability` (from the model),
   `verification_status` (from a human), `risk_level` (probability × exposure).
   All three visible in the UI, and kept distinct by database `CHECK`
   constraints.
2. **The AZ-1088 case** — probability 0.95, buildings 0, population 0, therefore
   risk **LOW**. This is the strongest thirty seconds of the demo.
3. **A human-authorisation gate on alerts** — a database constraint plus an
   append-only audit log. The AI cannot dispatch an alert on its own.
4. **The `is_demo_data` banner** — on every screen showing illustrative values.
5. **Lead time is the snake line's dashed forecast tail.** Lead time comes from
   the rainfall forecast, not from satellite imagery.

If time runs short, cut anything other than these five.

---

## 2. What is being cut, and how to say it on the slide

- **YOLO26 / YOLOv11 segmentation** — "designed for post-event mapping, not
  trained in this prototype. We also make no claim that YOLO26 is automatically
  better than YOLOv11."
- **SHAP explainability** — "feature attribution is planned; for now the index
  weights are themselves transparent."
- **SAR / InSAR** — "out of scope: C-band decorrelates under dense canopy."
- **Calibration and reliability diagrams** — "calibration is meaningless without
  a validated landslide inventory. The method is on the slide: temporal split,
  POD / FAR / CSI / Brier."
- **Citizen PWA and offline mode (Dexie, Workbox)** — "in the architecture, not
  in the prototype."
- **Admin UI and review queue** — a plain list will do, or cut entirely.
- **Runout raster propagation** — "we build the envelope from an empirical angle
  of reach, not full raster routing."

### The biggest honest downgrade — susceptibility

We do not have a validated landslide inventory. That means we cannot have a
trained model either. So susceptibility will be an **openly labelled
expert-weighted index** (slope, curvature, lithology class, distance to road
cut), with weights taken from the literature.

This is a strength rather than a weakness, for two reasons:

- Training a model without an inventory and then showing an AUC of 0.95 would
  be a lie. The R6 trap does exactly that: draw the negative examples from flat
  valley floors and the model learns "steep equals landslide". The number looks
  beautiful and the model is useless. This mistake appears in published papers.
- Since we are not training at all, that trap cannot be reached.

Slide wording: *"We did not train a model we could not validate. This is the
physically motivated index we used, and this is precisely the temporal-split
methodology by which we would train and validate it."*

---

## 3. Division of work — starting now

All three people work **in parallel**. Riya's and Rudra's work does **not**
depend on the backend. Riya builds against the mocks in `data/sample/`, and
after V9 exactly one line changes (see `docs/TEAM_ONBOARDING.md` §4).

### Vishwajeet — this evening

- **V3.5** connect Node to the database — done. `/health` now reports
  `database: "ok"` with `postgis: "3.4.3"`, and returns HTTP 503 with
  `status: "degraded"` when the database is unreachable.
- **V3.6** graceful shutdown — done, and it turned out to be a real bug rather
  than a formality. Verified by running the backend as PID 1 in a throwaway
  Linux container so that a genuine SIGTERM could be delivered: `docker stop`
  now exits in 719 ms with **exit code 0**, where before the fix it hung and was
  SIGKILLed (137) even though both shutdown log lines had printed. Fix:
  `forceCloseConnections: true`, a re-entrancy guard, and an 8-second hard
  deadline. Details in `docs/PROGRESS.md`.
- **V4** schema plus numbered SQL migrations plus `migrate.js`. This is where
  the argument becomes code:
  `CHECK (status <> 'DISPATCHED' OR authorised_by IS NOT NULL)`,
  `CHECK (probability BETWEEN 0 AND 1)`,
  `CHECK (confidence_lower <= confidence_upper)`,
  `verification_status DEFAULT 'PENDING_VERIFICATION'`,
  and revoking `UPDATE` / `DELETE` on the audit log from the application role.
- **V5** load `data/sample/mock_slope_units.geojson` into PostGIS, with a GiST
  index

### Vishwajeet — 4 September

- **V6** `GET /api/v1/slope-units` returning GeoJSON generated in SQL by
  `ST_AsGeoJSON`
- **V7** `POST /api/v1/ml/forecast` to ingest Rudra's JSON, returning **422** on
  a schema failure (Fastify's default is 400, so a `schemaErrorFormatter` is
  needed)
- **Exposure** — buildings and roads for Aizawl from the Overpass API (real
  data, ODbL, citable). The mock bounding box is small
  (92.7038, 23.7226 → 92.7440, 23.7620), so a single request is enough and
  osm2pgsql is not needed. Then `ST_Intersection` → `ST_Transform(…, 32646)` →
  length, area and chainage.
- **V11** verification endpoint — `PENDING_VERIFICATION` → `CONFIRMED` or
  `FALSE_POSITIVE`, recording the verifier's name
- **V13** alert authorisation, CAP 1.2 XML generation, and the audit-log entry,
  all within a single transaction

**On population, honestly:** we will not fabricate population figures. The
number will be a building count multiplied by a clearly stated occupancy
assumption, labelled `"Estimated potentially exposed population: …"`, with the
assumption written down in `data/README.md`. No number is displayed without its
assumption.

### Rudra — start now (R1 is done)

- **R2 Three-Tank SWI** — do this first. Roughly twenty lines, fixed parameters
  from the literature, no training data required. The most value for the least
  time.
- **Susceptibility index** — weighted, with the weights documented and
  "this is not a trained model" stated plainly
- **Failure probability** — tank state combined with susceptibility, formula
  documented, with a confidence band
- **Snake-line data** — cumulative short-term rainfall (X) against long-term
  wetness (Y), the critical curve, and the dashed forecast tail
- **Output** — the exact JSON from `docs/API_CONTRACT.md`, for the five mock
  slope units (`AZ-1142, AZ-1147, AZ-1203, AZ-1088, AZ-0964`).
  **Keep AZ-1088's probability high** — that is the demo's proof case.
- Before sending: `python -m json.tool <file>`
- Do not attempt: YOLO, SHAP, SAR, calibration, runout rasters

### Riya — start now

- **F1** Vite scaffold plus Tailwind v4 plus MapLibre (the exact commands and
  three traps are in `docs/TEAM_ONBOARDING.md` §7)
- **F2** Map with slope units coloured by `risk_level`, **not** by `probability`
- **F3** Decision card — probability with its confidence band, exposure figures
  (print `population_label` exactly as received), verification badge
- **F4** Verification buttons — `PENDING_VERIFICATION` → CONFIRMED or
  FALSE_POSITIVE
- **F5** Snake-line chart with the dashed forecast tail
- **Banner** — an orange banner whenever `meta.is_demo_data` is true. Mandatory.
- Do not attempt: PWA, offline, Dexie, Workbox, admin UI
- **Do not wait for the backend at any point.** Work against the mocks.

---

## 4. Integration and rehearsal — morning of 5 September

1. Post Rudra's JSON to `POST /api/v1/ml/forecast`
2. Switch Riya's `frontend/src/lib/api.js` from the mock import to a real fetch
   (one line)
3. Seed the demo data and verify the AZ-1088 case
4. Rehearse the whole demo **twice**, against a clock

---

## 5. The demo narrative — five beats

1. **The problem** — Aizawl, the monsoon, and the fact that lead time comes from
   the rainfall forecast rather than from satellite imagery
2. **The snake line** — show the dashed tail. "That tail is our lead time."
3. **Map and decision card** — the three separate values, together on one screen
4. **AZ-1088** — probability 0.95, exposure 0, risk LOW.
   *"If we derived risk from AI confidence, this would read HIGH and teams would
   be sent here. Resource misallocation is what kills people."*
5. **The authorisation gate** — attempt to dispatch an alert with no authoriser
   and let the database reject it. Then show the audit log.
   *"The AI can bring you this far. A human takes it from here."*

The banner stays on screen throughout.
