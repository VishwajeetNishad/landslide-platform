# Landslide Early Warning & Monitoring Platform — North Eastern Region
## Architecture, Tech Stack and Implementation Plan

**Version:** 0.1 (blueprint, pre-implementation)
**Date:** 2026-09-02
**Target:** internal intern-hackathon prototype, ~2026-09-05 (3 days)
**Status:** no code written yet. This document is the plan we build from and defend.

---

## 0. How to read this document

- **§1–3** — what we are building and why. Read this before touching code.
- **§4–9** — architecture, stack, data. The engineering reference.
- **§10–16** — component-by-component design.
- **§17** — **time estimates.** Hour-by-hour 3-day plan plus what a real deployment would cost.
- **§18–21** — evaluation, risks, scope boundaries, open verifications.

Anything marked **[VERIFY]** is something I could not confirm from an authoritative source in this session (web search was unavailable). Do not put a **[VERIFY]** claim on a presentation slide until someone has checked it.

---

## 1. The problem statement, and what it actually demands

The official statement asks for a platform that predicts and tracks landslide-prone areas in real time across the North Eastern Region, with seven lettered requirements (a–g).

Two things in it are easy to miss, and both change the design.

### 1.1 It asks for **prediction**, so the core is forecasting, not image detection

The data sources are listed in this order: **rainfall patterns → soil moisture sensors → satellite imagery → terrain/slope → historical records.** Rainfall and soil moisture come first. Satellite imagery is one input of five. The document never names a model, never says "segmentation," never says "YOLO."

This matters because of a hard physical fact:

> **Segmenting a landslide out of a satellite image requires an image of the landslide. By then it has already happened.** Lead time comes from the *rainfall forecast*, never from the imagery.

So the AI/ML engine is a **rainfall-and-soil-moisture-driven failure probability model**. Image segmentation stays in the system, but in its correct role (§3.2).

### 1.2 It asks for **two different models**, not one

> "Use AI/ML models to **identify high-risk zones** *and* **predict possible landslide events**"

| | Output | Update frequency | Question answered |
|---|---|---|---|
| **Susceptibility** | which slopes are inherently dangerous | yearly | *Where* must we not build? |
| **Hazard forecast** | which of those fail tonight | hourly | *When* do we act? |

Standard formulation: **Hazard = Susceptibility × Triggering.** Susceptibility is a static planning layer learned from terrain, geology, land cover and road cuts. The forecast pushes today's wetness state through it. Both are required; most competing teams will build one.

---

## 2. Requirement traceability matrix

The single most useful table in this document. Evaluation is a checklist — every row must have something visible in the demo.

| Req | Requirement | Component | Day | Prototype status | Honesty constraint |
|---|---|---|---|---|---|
| **a1** | Rainfall patterns | `ingest/rainfall.py` — IMD + GPM IMERG + ECMWF Open Data | 2 | Real data | — |
| **a2** | Soil moisture sensors | `POST /api/v1/sensors/readings` + SMAP L4 satellite moisture | 2 | Endpoint real; **no hardware** | Simulated nodes must carry a visible `SIMULATED` badge in the UI |
| **a3** | Satellite imagery | Sentinel-1 SAR + Sentinel-2, YOLO-seg post-event mapping | 2 | 1 pre-downloaded scene | State that monsoon cloud makes optical unreliable — this is *why* SAR |
| **a4** | Terrain / slope data | Copernicus DEM GLO-30 → slope, aspect, curvature, **slope units** | 1 | Real data | — |
| **a5** | Historical landslide records | GSI Bhukosh + NASA COOLR + our own inventory engine | 1 | Partial | Label scarcity is the field's binding constraint. Say so |
| **b** | AI/ML high-risk zones + prediction | LightGBM susceptibility **+** differentiable three-tank SWI | 2 | **Deep component** | Report POD / FAR / CSI / lead time. Never "94% accurate" |
| **c** | Real-time alerts | CAP 1.2 XML → SMS / app push, **human authorisation gate** | 3 | Mock gateway | AI drafts; a named human authorises (§14) |
| **d** | GIS mapping of roads/villages/infra | MapLibre + PostGIS; OSM + WorldPop | 3 | Real data | "Estimated potentially exposed," never "N people affected" |
| **e** | Citizen geo-tagged upload | PWA camera + GPS → review queue → **back into the model** | 3 | Working | Citizen reports are `UNVERIFIED` until an official confirms |
| **f1** | Risk severity levels | `risk_level` from probability × exposure | 2 | Working | Risk ≠ AI confidence ≠ verification status (§13) |
| **f2** | Road connectivity status | runout ∩ road network, reported by **chainage** | 2 | Working | "Potentially affected," not "blocked," unless field-confirmed |
| **f3** | Weather-linked risk forecast | **snake line** — wetness vs rainfall crossing a critical curve | 2 | Working | Best visual in the demo. Never cut |
| **f4** | Emergency response prioritisation | rank by exposed population × probability × access difficulty | 3 | Working | System ranks; humans decide |
| **g1** | Multilingual notifications | Bhashini/AI4Bharat, **human-verified fixed templates** | 3 | 2–3 languages | Never free-form machine translation for a life-safety message |
| **g2** | Offline / low-network | PWA service worker + IndexedDB; SMS as zero-bandwidth fallback | 3 | Working | SMS reaches where data does not — say this out loud |

**Every data source above is free and requires no permission from any agency.** Nothing in the critical path is blocked on an approval.

---

## 3. The core design decision: two paths, one shared downstream

### 3.1 Forecast path — this carries the "early warning" claim

```
IMD forecast + GPM IMERG + ECMWF        SMAP L4 soil moisture
              |                                  |
              +----------------+-----------------+
                               v
              THREE-TANK SOIL WATER INDEX  (per slope unit, hourly)
                               v
              SUSCEPTIBILITY (LightGBM, static terrain/geology/road-cut)
                               v
              FAILURE PROBABILITY  p(slope_unit, 12h window)
                               v
              RUNOUT ENVELOPE  (empirical angle-of-reach)
                               v
              EXPOSURE INTERSECTION  (buildings, roads by chainage, population, POIs)
                               v
              +--------- HUMAN REVIEW QUEUE ---------+   <-- nothing passes this by itself
                               v
              DECISION CARD  ->  CAP 1.2 XML  ->  SMS / app push / IVR
```

### 3.2 Detection path — this is where image segmentation belongs

```
Sentinel-1 SAR (coherence change)  +  Sentinel-2 (when cloud-free)
                               v
              YOLO-seg  (YOLOv11-seg baseline; YOLO26-seg compared, not assumed better)
                               v
    +--------------------------+--------------------------+
    v                          v                          v
POST-EVENT RAPID MAPPING   CONSTRUCTION CHANGE      DATED INVENTORY
(earthquake, zero lead      DETECTION (new cut       -----> feeds the
 time by physics)           slopes, muck dumps)      susceptibility model
```

**The loop is the story.** Detection builds the labelled inventory; the inventory trains the forecast; the forecast warns people; citizen reports (§15) verify and extend the inventory. That is a genuinely closed system, and it is a better narrative than either half alone.

### 3.3 The downstream half is deliberately hazard-agnostic

Slope-unit registry, runout intersection, exposure estimation, decision card, CAP alert, translation, SMS, audit log — **none of these care what produced the polygon.** Feed them a rainfall-triggered footprint, a coseismic scar, or a GLOF flood envelope and they behave identically.

This is the answer to "you didn't cover GLOF / earthquakes":

> We built a hazard-agnostic impact and alerting layer. v1 plugs in one hazard model — rainfall-triggered shallow slides, the most frequent regime. Coseismic mapping and GLOF flood routing plug into the same interface. Here is that interface.

That converts a gap into an architecture decision.

---

## 4. System architecture — five layers

```
+---------------------------------------------------------------------------+
| L5  PRESENTATION                                                           |
|     React + Vite PWA     | MapLibre GL dashboard | Citizen mobile PWA      |
|     Recharts (snake line)| Review queue          | Decision card           |
+---------------------------------------------------------------------------+
                                    | HTTPS / JSON, service-worker cached
+---------------------------------------------------------------------------+
| L4  API + AUTH                                                             |
|     Node.js  |  JWT + RBAC (SUPER_ADMIN / DISTRICT_ADMIN / FIELD_OFFICER   |
|     Fastify  |               / CITIZEN)  |  row-level district scoping     |
|              |  append-only audit log    |  JSON-schema route validation   |
+---------------------------------------------------------------------------+
+---------------------------------------------------------------------------+
| L3  ORCHESTRATION                                                          |
|     node-cron (hourly forecast cycle)   | Redis (cache + queue, optional)  |
|     Python jobs for heavy geo work      | idempotent runs, frozen inputs   |
+---------------------------------------------------------------------------+
+---------------------------------------------------------------------------+
| L2  DOMAIN LOGIC                                                           |
|  ingest/  | hydrology/ | ml/          | runout/ | exposure/ | alerting/    |
|  rainfall | 3-tank SWI | susceptibility| angle- | OSM +     | CAP 1.2      |
|  moisture | critical   | (LightGBM)   | of-    | WorldPop  | templates    |
|  imagery  | line       | SHAP + calib | reach  | chainage  | Bhashini     |
+---------------------------------------------------------------------------+
+---------------------------------------------------------------------------+
| L1  DATA                                                                   |
|     PostgreSQL 16 + PostGIS 3.4   (vector: slope units, roads, alerts)     |
|     Cloud-Optimized GeoTIFF on disk / S3-compatible  (raster: DEM, rain)   |
|     MinIO or local FS  (field-report photos)                               |
+---------------------------------------------------------------------------+
```

---

## 5. Tech stack — and why each choice

### 5.1 Backend

**Decision (revised at step V2): the API layer is Node.js, not Python.**

The original plan put the whole backend in Python/FastAPI. That was changed once
the split of work became concrete. The reasoning:

| Half of the system | Language | Why |
|---|---|---|
| API, auth, workflow, alerting, DB access | **Node.js** | This half is HTTP, JSON and SQL. The spatial work happens *inside PostGIS*, so the API layer only issues queries — it never touches a raster. Sharing JavaScript with the React frontend puts two of three developers in one language |
| Tank model, susceptibility, runout, SHAP | **Python** | Raster I/O (`rasterio`), labelled arrays (`xarray`), differentiable simulation (PyTorch) and explainability (SHAP) have no serious Node equivalent |

The boundary is `docs/API_CONTRACT.md` — plain JSON over HTTP, deliberately
language-agnostic. Nothing in that contract changed when the backend language did,
which is the point of writing the contract before the code.

**One genuine consequence:** runout computation (steepest-descent path on the DEM,
angle of reach) is raster work, so it moves into `ml/` on the Python side. The
contract already allows this — `mock_ml_output.json` carries
`runout.envelope_geojson`. The backend receives a finished polygon and intersects
it in PostGIS.

| Choice | Version | Why this and not the alternative |
|---|---|---|
| **Node.js** | **22 LTS** | Built-in test runner (`node --test`) and `--env-file` remove two dependencies. LTS means security patches through 2027 |
| **Fastify** | 5.x | Faster than Express, and schema-first: the JSON schema on each route *is* the validation *and* the OpenAPI documentation. Express would need `express-validator` plus `swagger-jsdoc` bolted on and kept in sync by hand |
| **@fastify/swagger + swagger-ui** | 9.x / 6.x | Interactive `/docs` page generated from the route schemas. Riya can test any endpoint in the browser without asking Vishwajeet |
| **@fastify/cors** | 10.x | Browsers block `localhost:5173 → localhost:8000` by default. This is the single most common blocker in frontend/backend integration; configured on day one |
| **node:test** | built-in | No Jest, no Vitest, no config file. `app.inject()` calls routes in-process — no port, no network, millisecond runs |
| **postgres** (or `pg`) | 3.x | PostGIS geometry is generated by SQL functions (`ST_AsGeoJSON`), so a thin driver is a better fit than an ORM that would need a spatial-type plugin |
| **node-cron** | 3.x | Runs the hourly forecast cycle in-process. Chosen over a separate worker service for the prototype — one fewer moving part |

**Schema-first validation replaces what Pydantic was doing.** The rule "never
accept a fabricated number" is still enforced in the type system, just a different
one: a route schema rejects `probability: 1.4`, a `runout` object with no
`source_citation`, or `confidence_lower > confidence_upper` — before the handler
ever runs.

### 5.2 Geospatial

| Choice | Why |
|---|---|
| **PostgreSQL 16 + PostGIS 3.4** | Spatial indexes (GiST) and `ST_Intersects` make "which buildings are in this runout polygon" a single fast query. Doing this in Python would be orders of magnitude slower |
| **rasterio** | Read/write GeoTIFF, windowed reads so we never load a whole DEM into RAM |
| **rioxarray + xarray** | Labelled multi-dimensional arrays — the right tool for *time-series* rainfall grids (time × lat × lon) |
| **geopandas 1.0 + shapely 2.x** | Vector operations in a DataFrame. Shapely 2 is vectorised and much faster than 1.8 |
| **pyproj** | CRS transforms (§8) |
| **WhiteboxTools** | Hydrological DEM conditioning, flow accumulation, watersheds, **Hillslopes** → our slope units (§10.2). Pure binary, no GRASS install needed — a major time saver |
| **GDAL** | Underlying everything; installed via conda to avoid Windows build pain |

### 5.3 Machine learning

| Choice | Why |
|---|---|
| **PyTorch 2.x (CPU is fine)** | The three-tank model is a *differentiable simulation* (§11.3). PyTorch gives us `loss.backward()` through the physics loop. No GPU needed at this scale |
| **LightGBM** | Susceptibility classifier. Beats deep nets on small tabular data, trains in seconds, handles missing values, gives native feature importance |
| **scikit-learn** | Metrics, `CalibratedClassifierCV`, spatial cross-validation splitters |
| **SHAP** | Per-alert explanation — "why did this slope fire?" Non-negotiable for official trust |
| **Ultralytics YOLO** | Detection path only. YOLOv11-seg as the published baseline, YOLO26-seg compared. **We report the measured comparison; we do not assume the newer one wins** |

### 5.4 Frontend

| Choice | Why |
|---|---|
| **React 18 + Vite** | Team decision: **React, not Next.js.** SSR buys little here — the dashboard is behind a login and the citizen app is a PWA that must work offline anyway. Vite's dev server starts in under a second, and there is no framework-specific routing or server-component model to learn under a 3-day deadline |
| **MapLibre GL JS** | Vector tiles, GPU rendering, **no API key and no licence cost** (Mapbox GL went proprietary). Handles thousands of slope-unit polygons smoothly; Leaflet would struggle |
| **Tailwind CSS** | Fast, consistent UI without inventing a design system in 3 days |
| **Recharts** | The snake-line chart and rainfall time series |
| **TanStack Query** | Server-state caching + retry — this is what makes flaky-network behaviour feel deliberate |
| **Dexie (IndexedDB)** | Offline queue for field reports (§16) |
| **Workbox service worker** | Caches map tiles, last known risk state, and the app shell for offline use |

### 5.5 Alerting and delivery

| Choice | Why |
|---|---|
| **CAP 1.2 XML** | The international standard for public alerts, and what India's SACHET platform consumes **[VERIFY the exact submission route]**. Emitting CAP means we plug into existing government pipes instead of inventing a channel |
| **Bhashini / AI4Bharat** | Indian-language translation. Used **only to fill human-verified fixed templates** — never free-form |
| **SMS gateway** | Mocked in the prototype (writes to DB + shows in UI). Production: an SMS aggregator or state-operated cell broadcast **[VERIFY procurement route]** |

### 5.6 Infrastructure

| Choice | Why |
|---|---|
| **Docker Compose** | Whole stack (`api`, `db`, `redis`, `web`, `worker`) with one command. Runs on a laptop for the demo *and* on one cheap VM. **Kubernetes would waste a day of our three** |
| **MinIO** (or local FS) | S3-compatible photo storage; swap the endpoint for real S3 later |
| **node:test** (backend) | Built into Node 22 — no Jest, no config file. `app.inject()` runs routes in-process, so tests need no port and finish in milliseconds |
| **pytest** (ml/) | Rudra's side. Required by the workflow rule: every step is tested before the next begins |
| **ruff** (Python) / **eslint** (Node) | Lint; catches errors before runtime |

---

## 6. Environment warning — read before Day 1

**This applies to `ml/` (Rudra's Python side). The Node backend has no such problem** — `npm install` in `backend/` takes about 20 seconds.

**Do not build the ML side on Python 3.14.**

`rasterio`, `GDAL`, `geopandas`, `shapely` and `whitebox` depend on compiled C/C++ extensions. Pre-built wheels for a brand-new Python release routinely lag by months, and without a wheel `pip install` tries to compile GDAL from source on Windows — which fails, or takes hours.

**Do this instead** (Miniforge / conda-forge is the reliable path on Windows):

```bash
conda create -n landslide -c conda-forge python=3.11 gdal rasterio geopandas shapely pyproj rioxarray xarray whitebox lightgbm scikit-learn
```

Then `pip install` the pure-Python ML packages (shap, ultralytics, pytest, torch) inside that environment.

**Golden rule:** geo packages come from conda only, never pip. Mixing the two produces `DLL load failed` errors that are painful to debug.

**Budget 1.5 hours for this and expect friction. It is the single most likely thing to eat Day 1** — and it is why the backend was moved off Python: the API layer no longer has to wait for this environment to work.

---

## 7. Data sources

Every row is free. Nothing needs an agency's permission.

| Data | Source | Resolution | Used for | Access |
|---|---|---|---|---|
| **DEM** | Copernicus DEM GLO-30 | 30 m | slope, aspect, curvature, slope units, runout paths | AWS Open Data / OpenTopography |
| **Rainfall — observed** | NASA GPM IMERG | 0.1°, 30 min | antecedent rainfall, tank forcing | NASA GES DISC (free Earthdata login) |
| **Rainfall — forecast** | ECMWF Open Data (IFS) | 0.25°, 6-hourly | the actual lead time | `ecmwf-opendata` Python client, no key |
| **Rainfall — official** | IMD | station / gridded | the authoritative Indian source | mausam.imd.gov.in — **[VERIFY API access + registration]** |
| **Soil moisture** | NASA SMAP L4 | 9 km, 3-hourly | initial tank state, req (a2) | NSIDC |
| **SAR** | Sentinel-1 GRD/SLC | ~10–20 m, ~6–12 day | post-event mapping through cloud | Copernicus Data Space Ecosystem |
| **Optical** | Sentinel-2 L2A | 10 m, ~5 day | mapping when cloud-free | Copernicus Data Space Ecosystem |
| **Land cover** | ESA WorldCover | 10 m | susceptibility feature | ESA, free |
| **Geology** | GSI Bhukosh | vector | lithology, structure | Bhukosh portal — **[VERIFY download format]** |
| **Landslide inventory** | GSI Bhukosh + NASA COOLR/GLC + our own engine | point/polygon | training labels | see §21 |
| **Buildings / roads / POIs** | OpenStreetMap | vector | exposure, chainage | Geofabrik extract + Overpass |
| **Population** | WorldPop | 100 m | exposed-population estimate | worldpop.org |
| **Earthquakes** | National Center for Seismology | catalogue | seismic-weakening term | seismo.gov.in — **[VERIFY API]** |

### 7.1 Two data rules that are non-negotiable

1. **Normalise rainfall by mean annual precipitation.** 100 mm/day is a disaster in a dry Himalayan valley and an ordinary Tuesday at Sohra, which receives on the order of 11,000–12,000 mm a year. A single absolute threshold across the NER is wrong. Use *fraction of local MAP* as the feature.
2. **Stratify by geological province.** Himalayan (Sikkim, Arunachal), Indo-Burman Ranges (Manipur, Mizoram, Nagaland, Dima Hasao — shales with bedding dipping out of slope), and the Shillong Plateau (Precambrian gneiss, thin soil on hard rock) fail by different mechanisms. **One model will not generalise across all three.** Train per province, or include province as an explicit feature and validate leave-province-out.

---

## 8. Coordinate reference systems

Getting this wrong silently corrupts every distance and area in the system.

| Purpose | CRS | Note |
|---|---|---|
| Storage, exchange, API, web map | **EPSG:4326** (WGS 84 lat/lon) | Degrees. **Never compute area or distance in this** |
| Metric computation — Mizoram, Manipur, Nagaland, Meghalaya, Assam | **EPSG:32646** (UTM 46N) | Covers 90°–96° E |
| Metric computation — Sikkim, west Bengal hills | **EPSG:32645** (UTM 45N) | Covers 84°–90° E |
| Web tiles | EPSG:3857 | MapLibre handles this |

**Rule:** reproject to UTM before any slope, area, length, buffer or runout-distance calculation; store the result back in 4326. Write this as a single utility function on Day 1 so nobody forgets.

---

## 9. Pilot district

**Aizawl, Mizoram** (~23.7° N, 92.7° E).

| Reason | Detail |
|---|---|
| A real validation event | May 2024, remnants of Cyclone Remal — a documented, recent disaster to hindcast against |
| Clean scope story | Indo-Burman geology, no glaciers → GLOF is *genuinely* out of scope, not dodged |
| Dramatic exposure | Very steep slopes with dense hillside settlement — the impact numbers are real and large |
| Road connectivity case | The Aizawl–Lunglei corridor gives req (f2) a concrete subject |
| Fast compute | Small enough that every step finishes in seconds, not minutes |

Alternatives if preferred: Noney/Tamenglong (Manipur, the 2022 railway-construction failure) or the Teesta/NH-10 corridor (Sikkim). **Nothing downstream depends on the choice** — one config file.

---

## 10. Layer 1 — the spatial substrate (Day 1)

### 10.1 Why not pixels

Modelling per 30 m pixel is a documented failure mode. A pixel is not a physical object; a hillside is. Pixel models leak information between adjacent training and test cells and produce speckled maps no engineer can act on.

### 10.2 Slope units — the unit of analysis

A **slope unit** is a half-basin: the terrain draining to one side of one stream segment. Typically 1–20 ha, a few thousand per district. It is the physically correct object because a single hillside shares one hydrological regime, and it is **operationally addressable** — you can give it an ID, put it in a registry, and inspect it.

**Pipeline (WhiteboxTools):**

```
Copernicus DEM GLO-30
  -> BreachDepressions        (hydrologically condition — better than filling)
  -> D8Pointer                (flow direction)
  -> D8FlowAccumulation
  -> ExtractStreams           (threshold tuned so units land in 1-20 ha)
  -> StreamLinkIdentifier
  -> Watershed
  -> Hillslopes               (splits each basin into left/right bank -> slope units)
  -> polygonise -> GeoDataFrame -> PostGIS
```

`Hillslopes` gives us half-basin slope units directly, **without needing GRASS GIS installed**. If time remains, `r.slopeunits` (Alvioli et al.) is the more rigorous upgrade — but it is not worth a day.

### 10.3 Per-unit static attributes

Computed once, stored on the row: mean/max slope, mean aspect (as sin/cos, never raw degrees — 359° and 1° are adjacent), local relief, planform and profile curvature, contributing area, Topographic Wetness Index, lithology class, land-cover class, distance to nearest road, **road-cut flag**, mean annual precipitation, and the **seismic-weakening term** (§20.2).

The road-cut flag matters: a large share of NER failures are on engineered cut slopes, not natural hillsides. A model blind to road cuts will misrank the most dangerous slopes in the district.

---

## 11. Layer 2 — the AI/ML engine (Day 2, the deep component)

### 11.1 Susceptibility model — "which slopes are dangerous"

- **Model:** LightGBM binary classifier, one row per slope unit.
- **Positives:** slope units containing a mapped historical landslide.
- **Negatives — this is where projects fail:** negatives must be **slope-matched**. If you sample negatives from flat valley floors, the model learns "steep = landslide," scores AUC 0.95, and is useless. Sample negatives from units with comparable slope and relief that have *no* recorded failure.
- **Calibration:** `CalibratedClassifierCV` (isotonic) so the output is a real probability, then plot a reliability diagram and report the Brier score.
- **Explanation:** SHAP values per unit.
- **Output:** `slope_unit.susceptibility_score` ∈ [0, 1].

### 11.2 The three-tank Soil Water Index — "how wet is it right now"

This is the flagship, and it is the reason a 3-day prototype is feasible: **the fixed-parameter version needs no training data at all.**

The idea, adapted from the Japan Meteorological Agency's Soil Water Index: model the hillside as three stacked buckets.

```
   rain
    |
    v
 [ TANK 1 ]  surface / shallow soil   -- fast, responds within hours
    | percolation      \ lateral outflow
    v
 [ TANK 2 ]  deeper soil              -- medium, days
    | percolation      \ lateral outflow
    v
 [ TANK 3 ]  weathered bedrock        -- slow, weeks
                       \ lateral outflow

 SWI = w1*S1 + w2*S2 + w3*S3
```

**Why this beats a rainfall threshold:** "150 mm in 24 h" ignores what happened last week. The tanks *carry memory*. The same 150 mm on a drained slope and on a saturated slope give completely different SWI — which is exactly the physics of shallow failure, and exactly why the May cyclone case (low antecedent moisture, huge intensity) behaves differently from a July case.

### 11.3 Making it differentiable and learnable

Implement the loop in PyTorch. Then the parameters for each slope unit can be *predicted* from its static attributes by a small MLP, and the whole thing trained end to end. Physics as a hard structural constraint, not a soft penalty term.

**We deliberately do not build a PINN.** Soft physics penalties in the loss are a documented failure mode (Krishnapriyan et al. 2021). Here the physics is the computation graph, so it cannot be violated.

```python
import torch
import torch.nn.functional as F

def tank_step(s, rain, p):
    """One hourly step of the three-tank model.
    s    : (N, 3) storage heights in mm, N slope units
    rain : (N,)   hourly rainfall in mm
    p    : dict of (N,) positive tensors
    """
    s1, s2, s3 = s[:, 0], s[:, 1], s[:, 2]

    # Lateral outflow, active only above height h.
    # softplus, NOT relu: relu gives exactly zero gradient on an empty
    # tank, so those parameters would never train.
    q1 = p['a1'] * F.softplus(s1 - p['h1'])
    q2 = p['a2'] * F.softplus(s2 - p['h2'])
    q3 = p['a3'] * F.softplus(s3 - p['h3'])

    # Vertical percolation downward
    perc1 = p['b1'] * F.softplus(s1)
    perc2 = p['b2'] * F.softplus(s2)

    s1n = s1 + rain  - q1 - perc1
    s2n = s2 + perc1 - q2 - perc2
    s3n = s3 + perc2 - q3

    s_new = torch.stack([s1n, s2n, s3n], dim=1).clamp(min=0.0)
    swi   = (p['w'] * s_new).sum(dim=1)          # p['w'] : (N, 3)
    return s_new, swi


def constrain(raw, lo, hi):
    """Keep every learned parameter inside a physically plausible range."""
    return lo + (hi - lo) * torch.sigmoid(raw)


# theta = MLP(static_attributes[slope_unit])  ->  constrain(...)  ->  p
# for t in hours:  s, swi = tank_step(s, rain[t], p)
# loss = focal_loss(head(swi, susceptibility), failure_label)
# loss.backward()   <-- gradients flow through the physics
```

**Build in this order, and present all three as an ablation table:**

| Stage | What | Needs training data? | Value |
|---|---|---|---|
| **A** | Fixed literature parameters + hand-drawn critical line | **No** | Already gives the snake-line demo. ~20 lines of code |
| **B** | LightGBM on tank states + static attributes | Yes, modest | Big accuracy jump for little work |
| **C** | Learnable per-unit parameters via MLP | Yes | The research contribution |

**Stage A alone is a working prototype.** Ship A, attempt B, present C as the roadmap if it does not converge in time. Showing the ablation is *more* convincing than showing only the fanciest version.

### 11.4 The snake line — the demo's best 20 seconds

Plot cumulative *short-term* rainfall on one axis against the *long-term* tank state on the other. The trajectory over a storm wriggles across the plane like a snake. A **critical curve** separates safe from failure. When the snake crosses the line, the slope is in a failure state.

Animate the May 2024 Aizawl case: the snake tracks along, crosses the critical curve, and the corresponding slope units light up on the map. This makes an abstract probability physically intuitive in one glance, for a non-technical judge.

### 11.5 Combining into a failure probability

```
p(failure | slope_unit, 12h window)
    = f( SWI trajectory,
         rainfall forecast (intensity, duration, fraction of local MAP),
         susceptibility_score,
         seismic_weakening_term,
         active field reports of cracks on this unit )   <-- §15
```

Output a **calibrated probability plus a confidence band**, where the band widens with distance to the nearest rain gauge. An honest "0.6 ± 0.25, nearest gauge 31 km" is worth more to a district officer than a confident-looking 0.6.

---

## 12. Runout and exposure (Day 2)

A landslide kills people *downslope* of where it starts. Initiation probability alone is not an impact warning.

**Method — empirical angle of reach, not dynamic simulation.** Dynamic runout modelling is weeks of work and needs calibration we do not have.

1. From the slope-unit outlet, trace the **steepest-descent path** on the DEM.
2. Stop where the line from source to current point drops below an empirical **angle of reach** (a literature value per material type — cite it).
3. Buffer the path by an empirical width → the **runout envelope** polygon.
4. `ST_Intersects` the envelope against OSM buildings, OSM roads, WorldPop grid, and POIs.

**Outputs, in exactly this language:**

- `estimated potentially exposed buildings: 17`
- `estimated potentially exposed population: ~120`
- `road potentially affected: Aizawl–Lunglei, chainage 4.2–4.5 km (340 m)`
- `critical facilities within envelope: 1 primary school`

**Chainage** — distance along a road from its origin — is how highway engineers actually locate things. Reporting "chainage 4.2 km" instead of a lat/lon is the difference between a demo and a tool a PWD engineer can use.

> **Never** write "road is blocked" — only "potentially affected," unless a verified field report confirms blockage.
> **Never** write "120 people are affected" — only "estimated potentially exposed population."
> **Never** invent a safe shelter location. Shelters come from the district's own verified list or the field is left empty.

---

## 13. Three concepts that must never be conflated

This is enforced in the schema, not just in documentation, because conflating them is the most common way these systems mislead.

| Concept | Set by | Values | Example |
|---|---|---|---|
| **Model probability / confidence** | the model | 0.0–1.0 + band | 0.93 |
| **Verification status** | a **human** admin | `PENDING_VERIFICATION`, `CONFIRMED`, `FALSE_POSITIVE`, `NEEDS_REVIEW` | CONFIRMED |
| **Risk level** | probability **×** exposure | `LOW`, `MEDIUM`, `HIGH` | LOW |

**Risk is never derived from probability alone.** A 0.95-probability failure on an empty forested hillside with nothing downslope is **LOW risk**. A 0.72-probability failure above a school is **HIGH risk**. Both of those combinations are valid and the UI must be able to display them.

```python
def risk_level(probability: float, exposure: Exposure) -> RiskLevel:
    """Risk = likelihood x consequence. Probability alone is NOT risk."""
    p_band = "low" if probability < 0.30 else "med" if probability < 0.60 else "high"

    if exposure.critical_facilities or exposure.population_estimate >= 100:
        e_band = "high"
    elif exposure.population_estimate >= 10 or exposure.road_metres > 0:
        e_band = "med"
    else:
        e_band = "low"

    MATRIX = {
        ("low",  "low"): LOW,    ("low",  "med"): LOW,    ("low",  "high"): MEDIUM,
        ("med",  "low"): LOW,    ("med",  "med"): MEDIUM,  ("med",  "high"): HIGH,
        ("high", "low"): LOW,    ("high", "med"): HIGH,    ("high", "high"): HIGH,
    }
    return MATRIX[(p_band, e_band)]
```

**Nothing is ever auto-confirmed.** Every prediction is born `PENDING_VERIFICATION`.

---

## 14. Alerting and the authorisation gate (Day 3)

### 14.1 Resolving "automated" against the law

The problem statement asks for an "automated SMS/app-based early warning system." Taken literally that would have software issuing public emergency alerts by itself. That is both against the project's own rules and against how India works: **IMD is the sole legally authorised issuer of weather warnings**, and SDMA/DDMA issue disaster alerts.

**Our reading, and this goes on a slide:**

> *Automated* means the system drafts the alert, computes exposure, geo-scopes the polygon, translates it and pre-fills the recipient list — in seconds, so no official is retyping anything at 2 a.m. It does **not** mean it fires without a named human pressing send. Every alert records the authoriser's identity in an immutable audit log.

This is not a hedge. **A system that can alert the public by itself is a system no state government will install.** The gate is a feature.

### 14.2 State machine

```
DRAFT ──(system generates)──> PENDING_AUTHORISATION
                                     │
              ┌──────────────────────┼──────────────────────┐
              v                      v                      v
         AUTHORISED             REJECTED              EXPIRED
       (human, logged)      (human + reason)       (window passed)
              │
              v
      DISPATCHED ──> DELIVERED / FAILED  (per channel, per recipient)
```

### 14.3 The decision card

What a district officer actually sees. Impact-based warning in WMO's sense — it states consequences and an action, not a number:

```
TONIGHT 20:00 - 08:00                                    [ HIGH RISK ]

Slope units AZ-1142, AZ-1147 - Melthum ward, Aizawl
Failure probability 0.72  (moderate confidence)
Verification: PENDING_VERIFICATION          <- human decision required

IF IT FAILS, WITHIN THE RUNOUT ENVELOPE:
  ~17 buildings potentially affected
  estimated potentially exposed population ~120
  Aizawl-Lunglei road, chainage 4.2-4.5 km (340 m) potentially affected
  1 primary school

WHY:  186 mm forecast in 24 h onto an already-saturated profile
      (SWI 142 mm, 88th percentile for this unit)
COUNTERFACTUAL: with 40 mm less antecedent rainfall, this would not have fired
DATA QUALITY:   nearest rain gauge 11 km - moderate rainfall confidence

[ AUTHORISE ALERT ]   [ REJECT ]   [ REQUEST FIELD VERIFICATION ]
```

Values shown are **illustrative formatting**, not real predictions.

The **counterfactual** line is what makes this trustworthy. "The model said so" is not actionable; "40 mm less rain and this would not have fired" tells an officer how close to the edge they are.

### 14.4 CAP 1.2 output

Standards-compliant XML with `<polygon>` set to the runout envelope, `<severity>`, `<certainty>`, `<onset>`, `<expires>`, and translated `<description>` blocks per language. Routable to SACHET **[VERIFY submission route]**. Emitting CAP means we integrate with government infrastructure rather than inventing a parallel channel.

---

## 15. Field reporting — requirement (e), done properly (Day 3)

Most teams will build this as a form that writes to a dead table. It should do **three jobs**, and one is scientific:

1. **A widening crack is a genuine precursor.** Tension cracks are one of the very few *visible* signs that a slope is about to move. So a crack report is not feedback — it is an observation that **should raise the failure probability for that slope unit.** Wire it into the model as a feature, with decay over time.
2. **It builds the historical inventory.** Label scarcity is the binding constraint on every landslide model in India. Each verified report becomes a dated, located, photographed training label.
3. **It creates trust.** A district officer believes a photo from a resident of Melthum ward far more readily than a probability.

**Flow:** citizen PWA → photo + GPS + device timestamp + category (`CRACK` / `SLOPE_MOVEMENT` / `ROAD_BLOCK` / `DEBRIS_FLOW`) → queued in IndexedDB if offline → syncs when a connection returns → snapped to the containing slope unit → appears in the officer's review queue as `UNVERIFIED` → officer sets `CONFIRMED` / `REJECTED` → confirmed reports feed both the live risk score and the training inventory.

**This closes the loop: citizens improve the model that warns citizens.** It costs no extra engineering beyond deciding to route the report into the risk score instead of into storage.

---

## 16. Offline and multilingual — requirement (g) (Day 3)

### 16.1 Offline

| Mechanism | What it does |
|---|---|
| **Workbox service worker** | Caches app shell, map tiles for the district, and the last known risk state. The app opens and shows yesterday's risk map with no connection |
| **Dexie / IndexedDB** | Queues outgoing field reports and photos; background sync flushes them on reconnect |
| **Stale-while-revalidate** | Always renders something, with a visible "last updated 4 h ago" stamp — never a blank screen, never a silent stale number |
| **SMS fallback** | The zero-bandwidth channel. SMS reaches places data does not. Say this explicitly in the demo |

### 16.2 Multilingual

Target Mizo, Hindi and English for the pilot; Bhashini/AI4Bharat for translation.

**The rule:** translation fills **human-verified fixed templates**, never free-form generation.

```
EN: "Landslide risk HIGH tonight 20:00-08:00 in {ward}. Move to {shelter} if advised by DDMA. Avoid {road} between {chainage_start}-{chainage_end} km."
```

Each language's template is reviewed once by a fluent speaker and frozen. Only the slots are filled at runtime. **A mistranslated life-safety message can kill someone**, so no LLM writes alert prose at send time.

---

## 17. Time estimates

### 17.1 The prototype — 3 days

Assumes a 6-person team working in parallel, and the environment problem in §6 solved first. Hours are *person-hours*; the wall-clock column assumes sensible parallelisation.

#### Day 1 — the substrate (~11 person-hours, ~5 h wall clock)

| Task | Hours | Owner | Risk |
|---|---|---|---|
| conda environment, all geo libs importing, `pytest` green | 1.5 | 1 | **HIGH** — most likely time sink |
| Docker Compose up: Postgres + PostGIS + Redis; initial SQL migrations | 1.5 | 1 | Low |
| Download Copernicus DEM for Aizawl; compute slope/aspect/curvature; render a PNG you can look at | 2.0 | 1 | Low |
| Slope units via WhiteboxTools chain (§10.2); tune stream threshold to 1–20 ha | 3.0 | 2 | **MEDIUM** — threshold tuning is fiddly. Fallback: watershed basins without the hillslope split |
| Load OSM buildings/roads/POIs, WorldPop, WorldCover, geology into PostGIS | 2.0 | 1 | Low |
| Compute and store per-unit static attributes | 1.0 | 1 | Low |

**Day 1 exit test:** a MapLibre page showing real slope-unit polygons for Aizawl, clickable, each returning its attributes from PostGIS.

#### Day 2 — the engine (~13 person-hours, ~6 h wall clock)

| Task | Hours | Owner | Risk |
|---|---|---|---|
| Rainfall ingest: GPM IMERG historical + ECMWF Open Data forecast → per-unit hourly series | 2.5 | 1 | **MEDIUM** — Earthdata auth and GRIB parsing bite |
| SMAP soil moisture ingest; sensor `POST` endpoint with `SIMULATED` flag | 1.5 | 1 | Low |
| Three-tank model, **Stage A** fixed literature parameters | 2.0 | 1 | Low — this is ~20 lines and cannot really fail |
| Critical line + snake-line chart, animated on the May 2024 case | 2.0 | 1 | Low — **highest demo value per hour** |
| Susceptibility LightGBM with slope-matched negatives + calibration + SHAP | 3.0 | 1 | **HIGH** — depends entirely on inventory quality |
| Runout (steepest descent + angle of reach) and exposure intersection | 3.0 | 1 | Medium |

**Day 2 exit test:** feed the May 2024 rainfall in; slope units light up; the snake line crosses; clicking a unit returns probability, runout polygon, and real exposure counts.

#### Day 3 — the surface (~17 person-hours, ~7 h wall clock) — the crunch

| Task | Hours | Owner | Risk |
|---|---|---|---|
| Fastify endpoints + JWT + RBAC district scoping + audit log | 3.0 | 1 | Medium |
| MapLibre dashboard: risk heatmap, layer toggles, unit detail panel | 4.0 | 2 | Medium |
| Citizen PWA: camera, GPS, category, IndexedDB offline queue | 2.5 | 1 | Medium |
| Review queue + decision card + authorisation state machine | 3.0 | 1 | Medium |
| CAP 1.2 XML generation, 3-language templates, mock SMS log | 1.5 | 1 | Low |
| Response prioritisation ranking view | 1.0 | 1 | Low |
| Deck (6 slides) + **two full rehearsals** | 3.0 | 1 | **Do not skip the rehearsals** |

**Total: ~41 person-hours over 3 days.** For 6 people that is roughly 7 hours each — achievable, but only with the environment solved on hour one and no scope creep.

### 17.2 Cut list, in order

Decide this **now**, not at 2 a.m. on Day 3.

| Cut first | Why it is safe to cut |
|---|---|
| Stage C learnable tank parameters | Stage A already demos; C is the roadmap slide |
| SAR / Sentinel-1 processing | Detection path, not the early-warning claim |
| Real Bhashini API calls | Ship 3 hand-written frozen templates instead |
| YOLO-seg comparison run | Present as planned work with the baseline citation |
| Redis job queue | node-cron in-process is enough |
| Seismic-weakening term | A nice differentiator, not load-bearing |

**Never cut:** the snake line, the decision card, the human authorisation gate, and the rehearsals. Those four *are* the presentation.

### 17.3 What a real deployment would actually cost

Be honest about this if asked — it is a credibility question, not a trap.

| Phase | Duration | Content |
|---|---|---|
| Prototype (this) | 3 days | One district, one regime, demo-grade |
| Pilot-ready | **3–4 months** | Real inventory built and verified, blocked cross-validation, calibration, hardened API, security review |
| **Shadow operation** | **one full monsoon (~4 months)** | Runs live, issues **no** public alerts, forecasts logged and scored against what actually happened |
| Operational | +2–3 months | SDMA/DDMA integration, SACHET routing, SOP sign-off, officer training |

**The shadow monsoon is not optional and is not padding.** No state will let software warn the public before it has one season of scored performance. Saying this unprompted is one of the strongest credibility signals available — it shows you understand deployment, not just modelling.

---

## 18. Evaluation — how we prove it works

### 18.1 Validation splits (get this wrong and every number is fiction)

| Split | Why |
|---|---|
| **Spatially blocked** | Hold out *entire* slope units / sub-basins. Random pixel splits put neighbouring cells in train and test, inflating AUC from a real ~0.7 to a fake ~0.95 |
| **Temporally held out** | Hold out *entire monsoon seasons*. Never train on 2024 and test on a different day of 2024 |
| **Leave-province-out** | Train on Indo-Burman, test on Shillong Plateau. This is the only honest test of generalisation across the NER |

**Temporal leakage check:** no feature may be derived from data recorded *after* the event it predicts. This sounds obvious and is the single most common silent bug in published landslide ML.

### 18.2 Metrics — and one word never to use

**Never report "accuracy."** Landslides are rare; predicting "no landslide" every day scores over 99%.

| Metric | Meaning |
|---|---|
| **POD** (probability of detection) | of real events, what fraction did we warn about? |
| **FAR** (false alarm ratio) | of our warnings, what fraction had no event? |
| **CSI** (critical success index) | the honest combined score for rare events |
| **Brier score + reliability diagram** | are the probabilities *calibrated*? Does "0.7" happen 70% of the time? |
| **Lead-time distribution** | median and spread of hours between warning and event. **For an early-warning system this is the headline number** |

**FAR must be reported as an upper bound.** An apparent false alarm may be a real landslide nobody recorded — in remote NER terrain, unrecorded failures are common. Stating this shows you understand your own data.

### 18.3 Baselines to beat, by name

A model with no baseline is unevaluable. Compare against:

1. a fixed 24-hour rainfall threshold,
2. a published regional intensity–duration threshold,
3. NASA LHASA (the global landslide nowcast).

"We beat a 24-hour rainfall threshold on CSI, at these lead times" is a real result. "Our AUC is 0.94" is not.

### 18.4 The hindcast demo

Replay the May 2024 Aizawl event with **inputs frozen at a stated cut-off time** — nothing after it enters the model. Label the slide **"retrospective hindcast."** Present it as a **ranking** (did the failed slopes rank in the top N?), not as binary hit/miss. Anyone who has evaluated a forecast will recognise the honesty, and the ones who haven't will still find it convincing.

---

## 19. Database schema

> **What the prototype actually builds (V4.2, 3 September 2026).**
> The SQL below is the full design. The prototype builds a trimmed subset:
> `district`, `app_user`, `slope_unit`, `forecast_run`, `prediction`,
> `runout_envelope`, `exposure`, `alert`, `audit_log`. Deliberately **not**
> built yet: `rainfall`, `soil_moisture`, `tank_state`, `field_report`,
> `landslide_inventory` — tank state and rainfall arrive inside the model's
> JSON and are stored as `JSONB` on `prediction`, because nothing in the
> prototype queries them across time.
>
> The live schema is `backend/src/db/migrations/*.sql`, and **those files are
> the source of truth**, not this section. They also carry constraints added
> since this was written: a temporal-leakage check on `forecast_run`, a
> confidence band that must contain its own point estimate, a verification
> status that cannot leave `PENDING_VERIFICATION` without a named human, and
> per-row provenance (`slope_unit.source`, `forecast_run.is_demo_data`). The
> audit log is made append-only by a **trigger** rather than by `REVOKE`,
> because our application connects as the table owner and PostgreSQL skips
> privilege checks for owners and superusers — the `REVOKE` would have been
> silently ineffective. See `docs/PROGRESS.md` V4.2.

```sql
-- ============ spatial substrate ============
CREATE TABLE slope_unit (
    id                    TEXT PRIMARY KEY,        -- e.g. 'AZ-1142'
    district_id           TEXT NOT NULL REFERENCES district(id),
    geom                  GEOMETRY(POLYGON, 4326) NOT NULL,
    centroid              GEOMETRY(POINT,   4326) NOT NULL,
    area_ha               DOUBLE PRECISION NOT NULL,
    mean_slope_deg        DOUBLE PRECISION,
    max_slope_deg         DOUBLE PRECISION,
    aspect_sin            DOUBLE PRECISION,        -- never store raw degrees
    aspect_cos            DOUBLE PRECISION,
    relief_m              DOUBLE PRECISION,
    profile_curvature     DOUBLE PRECISION,
    twi                   DOUBLE PRECISION,
    lithology_class       TEXT,
    landcover_class       TEXT,
    geological_province   TEXT,                    -- HIMALAYAN|INDO_BURMAN|SHILLONG_PLATEAU
    dist_to_road_m        DOUBLE PRECISION,
    has_road_cut          BOOLEAN DEFAULT FALSE,
    mean_annual_precip_mm DOUBLE PRECISION,        -- for rainfall normalisation
    susceptibility_score  DOUBLE PRECISION,
    seismic_weakening     DOUBLE PRECISION DEFAULT 0
);
CREATE INDEX slope_unit_geom_idx ON slope_unit USING GIST (geom);

-- ============ forcing ============
CREATE TABLE rainfall (
    slope_unit_id TEXT REFERENCES slope_unit(id),
    ts            TIMESTAMPTZ NOT NULL,
    mm            DOUBLE PRECISION NOT NULL,
    kind          TEXT NOT NULL,   -- OBSERVED | FORECAST
    source        TEXT NOT NULL,   -- IMD | GPM_IMERG | ECMWF_OPENDATA
    PRIMARY KEY (slope_unit_id, ts, kind, source)
);

CREATE TABLE soil_moisture (
    slope_unit_id TEXT REFERENCES slope_unit(id),
    ts            TIMESTAMPTZ NOT NULL,
    value         DOUBLE PRECISION NOT NULL,
    source        TEXT NOT NULL,   -- SMAP_L4 | SENSOR
    is_simulated  BOOLEAN NOT NULL DEFAULT FALSE,   -- surfaced in the UI
    sensor_id     TEXT,
    PRIMARY KEY (slope_unit_id, ts, source)
);

CREATE TABLE tank_state (
    slope_unit_id TEXT REFERENCES slope_unit(id),
    ts            TIMESTAMPTZ NOT NULL,
    s1_mm DOUBLE PRECISION, s2_mm DOUBLE PRECISION, s3_mm DOUBLE PRECISION,
    swi_mm DOUBLE PRECISION,
    PRIMARY KEY (slope_unit_id, ts)
);

-- ============ prediction ============
CREATE TABLE forecast_run (
    id               BIGSERIAL PRIMARY KEY,
    run_ts           TIMESTAMPTZ NOT NULL,
    input_cutoff_ts  TIMESTAMPTZ NOT NULL,   -- reproducibility: nothing after this was used
    model_version    TEXT NOT NULL,
    is_hindcast      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE prediction (
    id                  BIGSERIAL PRIMARY KEY,
    forecast_run_id     BIGINT REFERENCES forecast_run(id),
    slope_unit_id       TEXT   REFERENCES slope_unit(id),
    valid_from          TIMESTAMPTZ NOT NULL,
    valid_to            TIMESTAMPTZ NOT NULL,

    probability         DOUBLE PRECISION NOT NULL,   -- the MODEL's number
    confidence_lower    DOUBLE PRECISION,
    confidence_upper    DOUBLE PRECISION,

    risk_level          TEXT NOT NULL,   -- LOW|MEDIUM|HIGH  <- probability x EXPOSURE
    verification_status TEXT NOT NULL
        DEFAULT 'PENDING_VERIFICATION',  -- set by a HUMAN, never by the system
    verified_by         BIGINT REFERENCES app_user(id),
    verified_at         TIMESTAMPTZ,

    drivers             JSONB,   -- SHAP values
    counterfactual      TEXT,
    nearest_gauge_km    DOUBLE PRECISION,

    CONSTRAINT prob_range CHECK (probability BETWEEN 0 AND 1),
    CONSTRAINT vstatus CHECK (verification_status IN
        ('PENDING_VERIFICATION','CONFIRMED','FALSE_POSITIVE','NEEDS_REVIEW'))
);

CREATE TABLE runout_envelope (
    prediction_id BIGINT PRIMARY KEY REFERENCES prediction(id),
    geom          GEOMETRY(POLYGON, 4326) NOT NULL,
    method        TEXT NOT NULL,    -- 'empirical_angle_of_reach'
    angle_of_reach_deg DOUBLE PRECISION,
    source_citation    TEXT NOT NULL   -- every parameter is attributable
);
CREATE INDEX runout_geom_idx ON runout_envelope USING GIST (geom);

CREATE TABLE exposure (
    prediction_id        BIGINT PRIMARY KEY REFERENCES prediction(id),
    buildings_count      INTEGER,
    population_estimate  INTEGER,     -- ALWAYS rendered as "estimated potentially exposed"
    population_source    TEXT,        -- 'WorldPop 2020 100m'
    road_segments        JSONB,       -- [{name, chainage_start_km, chainage_end_km, metres}]
    critical_facilities  JSONB,       -- [{type, name, osm_id}]
    is_estimate          BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============ alerting ============
CREATE TABLE alert (
    id             BIGSERIAL PRIMARY KEY,
    prediction_id  BIGINT REFERENCES prediction(id),
    status         TEXT NOT NULL DEFAULT 'DRAFT',
    cap_xml        TEXT,
    authorised_by  BIGINT REFERENCES app_user(id),  -- NEVER null once dispatched
    authorised_at  TIMESTAMPTZ,
    rejection_reason TEXT,
    CONSTRAINT alert_status CHECK (status IN
        ('DRAFT','PENDING_AUTHORISATION','AUTHORISED','REJECTED','DISPATCHED','EXPIRED')),
    -- the authorisation gate, enforced by the database:
    CONSTRAINT must_be_authorised_before_dispatch CHECK (
        status <> 'DISPATCHED' OR authorised_by IS NOT NULL)
);

-- ============ field reporting (req e) ============
CREATE TABLE field_report (
    id            BIGSERIAL PRIMARY KEY,
    geom          GEOMETRY(POINT, 4326) NOT NULL,
    slope_unit_id TEXT REFERENCES slope_unit(id),   -- snapped on ingest
    category      TEXT NOT NULL,   -- CRACK|SLOPE_MOVEMENT|ROAD_BLOCK|DEBRIS_FLOW
    media_url     TEXT,
    device_ts     TIMESTAMPTZ,     -- when the phone says it was taken
    received_ts   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- may be much later (offline sync)
    reporter_id   BIGINT REFERENCES app_user(id),
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
    verified_by   BIGINT REFERENCES app_user(id),
    notes         TEXT
);
CREATE INDEX field_report_geom_idx ON field_report USING GIST (geom);

-- ============ inventory (training labels) ============
CREATE TABLE landslide_inventory (
    id                    BIGSERIAL PRIMARY KEY,
    geom                  GEOMETRY(GEOMETRY, 4326) NOT NULL,
    event_date            DATE,
    date_uncertainty_days INTEGER,      -- honesty about label quality
    location_uncertainty_m DOUBLE PRECISION,
    trigger_type          TEXT,         -- RAINFALL|SEISMIC|CONSTRUCTION|UNKNOWN
    source                TEXT NOT NULL,-- GSI_BHUKOSH|COOLR|NEWS|FIELD_REPORT|SAR
    source_citation       TEXT NOT NULL,
    source_quote          TEXT,         -- the sentence the date/place came from
    verified_by           BIGINT REFERENCES app_user(id)
);

-- ============ access control + audit ============
CREATE TABLE app_user (
    id       BIGSERIAL PRIMARY KEY,
    email    TEXT UNIQUE NOT NULL,
    role     TEXT NOT NULL,   -- SUPER_ADMIN|DISTRICT_ADMIN|FIELD_OFFICER|CITIZEN
    assigned_districts TEXT[] NOT NULL DEFAULT '{}'   -- row-level scoping
);

CREATE TABLE audit_log (            -- append-only; no UPDATE, no DELETE grant
    id        BIGSERIAL PRIMARY KEY,
    ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id  BIGINT REFERENCES app_user(id),
    action    TEXT NOT NULL,
    entity    TEXT NOT NULL,
    entity_id TEXT,
    before    JSONB,
    after     JSONB
);
```

**Four rules encoded above, not merely documented:**
1. `probability`, `risk_level` and `verification_status` are **three separate columns**. Risk cannot be a view over probability.
2. `verification_status` defaults to `PENDING_VERIFICATION` — nothing self-confirms.
3. A `CHECK` constraint makes it impossible to dispatch an alert with no human authoriser.
4. `runout_envelope.source_citation` is `NOT NULL` — every physical parameter is attributable.

---

## 20. API surface

```
POST   /api/v1/auth/login                         -> JWT

GET    /api/v1/districts/{id}/slope-units         -> GeoJSON FeatureCollection
GET    /api/v1/slope-units/{id}                   -> attributes + latest prediction
GET    /api/v1/slope-units/{id}/tank-history      -> snake-line series

GET    /api/v1/risk/current?district=             -> heatmap layer (req f1)
GET    /api/v1/risk/forecast?hours=48             -> weather-linked timeline (req f3)
GET    /api/v1/roads/status?district=             -> connectivity (req f2)
GET    /api/v1/response/priority?district=        -> ranked queue (req f4)

GET    /api/v1/predictions/{id}                   -> full decision card
PATCH  /api/v1/predictions/{id}/verification      -> human sets status (audited)

POST   /api/v1/alerts/{id}/authorise              -> the gate. logs the authoriser
POST   /api/v1/alerts/{id}/reject                 -> requires a reason
GET    /api/v1/alerts/{id}/cap.xml                -> CAP 1.2

POST   /api/v1/field-reports                      -> multipart photo + GPS (req e)
GET    /api/v1/field-reports?status=UNVERIFIED    -> review queue
PATCH  /api/v1/field-reports/{id}/verification    -> officer confirms

POST   /api/v1/sensors/readings                   -> soil moisture ingest (req a2)

GET    /api/v1/hindcast/{event_id}                -> frozen-input replay (§18.4)
```

**RBAC:** every district-scoped route filters on `app_user.assigned_districts`. A LOCAL/DISTRICT_ADMIN for Aizawl cannot read Sikkim data — enforced in a dependency, tested with an explicit negative test on Day 3.

---

## 21. Repository layout

```
landslide-platform/
├── docs/
│   ├── ARCHITECTURE.md              <- this file
│   ├── API_CONTRACT.md              <- fixed JSON shapes: ML -> backend -> frontend
│   ├── IMPLEMENTATION_STEPS.md      <- V0-V14, R1-R8, F1-F8
│   ├── GIT_WORKFLOW.md              <- branching, commits, conflict rules
│   ├── DATA_SOURCES.md              <- URL, licence, citation, retrieval date
│   └── EVALUATION.md                <- metrics, splits, baseline results
├── backend/                         Node.js -- Vishwajeet
│   ├── package.json
│   ├── src/
│   │   ├── server.js                starts the HTTP listener
│   │   ├── app.js                   builds the app (no listener -> fast tests)
│   │   ├── core/                    config.js auth.js rbac.js audit.js
│   │   ├── routes/                  meta.js slopeUnits.js predictions.js
│   │   │                            risk.js fieldReports.js alerts.js
│   │   ├── db/                      pool.js schema.sql migrations/ queries/
│   │   ├── ingest/                  rainfall.js moisture.js mlOutput.js
│   │   ├── ml/                      calibration.js explain.js
│   │   ├── exposure/                intersect.js chainage.js
│   │   ├── alerting/                cap.js templates/ dispatch.js authorise.js
│   │   └── scheduler.js             hourly cycle (node-cron)
│   └── test/
├── ml/                              Python -- Rudra
│   ├── terrain/                     dem.py slope_units.py attributes.py
│   ├── hydrology/                   tank.py critical_line.py
│   ├── susceptibility/              train.py calibration.py explain.py
│   ├── runout/                      angle_of_reach.py   <- raster work lives here
│   ├── notebooks/                   exploration only, never the pipeline
│   └── experiments/                 ablation A / B / C
├── frontend/                        React + Vite -- Riya
│   └── src/
│       ├── dashboard/               map, risk, roads, priority, review
│       ├── citizen/                 camera + GPS PWA
│       ├── components/              Map, SnakeLine, DecisionCard, RiskBadge
│       ├── lib/                     api client, mock JSON
│       └── offline/                 dexie queue, service worker
├── data/
│   ├── sample/                      mock JSON -- committed
│   ├── raw/                         gitignored
│   └── processed/                   gitignored
├── environment.yml                  Python env for ml/
├── docker-compose.yml
└── README.md
```

**Note on `runout/`:** it sits in `ml/`, not `backend/`. Runout is a raster
computation (steepest-descent path on the DEM), and raster tooling is Python's
strength. The backend receives a finished polygon through
`runout.envelope_geojson` in the API contract and intersects it in PostGIS.

---

## 22. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Python 3.14 breaks the geo stack | ~~High~~ **Reduced** | Blocks `ml/` only | conda-forge + Python 3.11, done at V0 ✅. **Further reduced at V2:** the backend moved to Node, so the API layer no longer depends on this environment at all. If Rudra's env breaks, Vishwajeet and Riya keep working |
| 2 | Slope-unit threshold tuning eats Day 1 | Medium | Cascades | Timebox to 3 h; fall back to watershed basins without the hillslope split |
| 3 | Inventory too sparse to train susceptibility | **High** | No Stage B/C | Ship Stage A (needs no training data); show inventory engine as the roadmap |
| 4 | NASA Earthdata / ECMWF auth or GRIB parsing friction | Medium | No forcing data | Pre-download the May 2024 window to disk on Day 1 evening and cache it |
| 5 | Day 3 frontend overruns | **High** | No demo | Build the demo path first, polish never. Two rehearsals are booked, not optional |
| 6 | Demo depends on live internet | Medium | Fatal on stage | **Everything runs from a local cache. Assume the venue wifi fails** |
| 7 | Judge asks about GLOF/earthquake coverage | High | Looks like a gap | Pre-empt with the "deliberately not built, and why" slide (§23) |
| 8 | A [VERIFY] claim is wrong on a slide | Medium | Credibility | No uncited number goes on a slide |

---

## 23. Deliberately not built — and why

Put this on a slide. Your own scope boundary, stated first, is worth more than a boundary a judge finds.

| Excluded | Why |
|---|---|
| **Earthquake landslide prediction** | **Zero lead time by physics** — shaking and sliding are simultaneous. Instead: rapid post-event SAR mapping, plus a time-decaying seismic-weakening term (the whole NER is Seismic Zone V, and a shaken slope fails later under ordinary rain) |
| **GLOF / glacial lake outburst** | A different hazard chain — lake monitoring → moraine breach → flood routing, not slope stability. Also glaciated Sikkim/Arunachal only, and often transboundary. **Our impact and alerting layer is reusable for its flood polygon** (§3.3) |
| **Wind as a trigger** | Windthrow is real but marginal. Cyclone *rainfall* is the trigger. Handled as a **low-antecedent-moisture rainfall regime** — which is precisely why a mid-monsoon-calibrated threshold mishandles a May cyclone, and why the tank model matters |
| **Deep-seated slow deformation** | Needs multi-year InSAR/GNSS time series. C-band InSAR decorrelates under dense evergreen canopy; layover/shadow and 1-D line-of-sight sensitivity break it in this terrain. **L-band NISAR is the future path** |
| **Issuing warnings directly to the public** | IMD is the sole legal issuer of weather warnings; SDMA/DDMA issue disaster alerts. We generate, geo-scope, translate and route — a **named human authorises** (§14) |
| **Kubernetes / microservices** | Docker Compose on one VM. A district IT cell must be able to run this |

---

## 24. Open verifications — do these before the presentation

I could not confirm these in this session (web search unavailable, and both the GSI and NESAC sites were unreachable). **Do not put any of them on a slide unverified.**

1. **Which districts, if any, GSI's landslide early warning covers for the 2026 monsoon, and the remit of the National Landslide Forecasting Centre, Kolkata.** Best source: Lok Sabha / Rajya Sabha question answers to the Ministry of Mines — they are precise, dated and citable. *This matters because if you claim a gap that GSI already fills, you lose the room.*
2. **Whether NESAC (Umiam, Meghalaya) operates any landslide service**, alongside its FLEWS flood system. If it does, the correct framing is "extends FLEWS to landslides," which is far stronger than proposing something parallel.
3. **A citable casualty and damage figure for whichever event opens your deck.** Use NDMA/SDMA situation reports or PIB releases. **Never a news aggregator.** A number without a citation does not go on a slide.
4. **The actual submission route into SACHET** for CAP messages.
5. **IMD API access terms** and whether registration is needed.

One presentation rule while we are here: **never place the State Emblem of India on a slide** — its use is restricted under the State Emblem of India (Prohibition of Improper Use) Act, 2005.

---

## 25. The one-line summary

> A hazard-agnostic impact and alerting platform for the North Eastern Region, with a rainfall-and-soil-moisture-driven failure-probability engine over hydrologically-derived slope units, delivering impact-based decision cards through a human authorisation gate — and honest about the two trigger regimes where forecasting is physically impossible.
