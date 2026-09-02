# Landslide Early Warning & Monitoring Platform — North Eastern Region

AI-powered landslide early-warning, post-event detection, verification, risk
assessment, impact assessment and disaster-response platform.
Pilot district: **Aizawl, Mizoram**.

> **Status:** prototype under active development (3-day build).
> Values shown in the demo are **illustrative**. They are not operational forecasts.

---

## What this system does

```
Rainfall forecast + Soil moisture
            v
Three-Tank Soil Water Index  (per slope unit, hourly)
            v
Slope susceptibility  (static: terrain, geology, land cover, road cuts)
            v
Failure probability  =  Hazard  =  Susceptibility x Triggering
            v
Runout envelope  (empirical angle of reach)
            v
Exposure  (buildings, population, roads by chainage, critical facilities)
            v
Risk level  =  probability  x  exposure          <-- NOT probability alone
            v
Human verification                                <-- nothing self-confirms
            v
Decision card
            v
Human authorisation                               <-- no auto public alert
            v
Alert  (CAP 1.2 XML -> SMS / app / IVR)
```

### Scientific distinctions we do not blur

| Concept | Set by | Values |
|---|---|---|
| **Model probability** | the model | 0.0–1.0 with a confidence band |
| **Verification status** | a **human** officer | `PENDING_VERIFICATION`, `CONFIRMED`, `FALSE_POSITIVE`, `NEEDS_REVIEW` |
| **Risk level** | probability **x** exposure | `LOW`, `MEDIUM`, `HIGH` |

- **Susceptibility** = which slopes are inherently dangerous (changes yearly).
- **Hazard forecast** = which of those may fail in the current window (changes hourly).
- Lead time comes from the **rainfall forecast**, not from satellite imagery.
- Satellite/YOLO segmentation is for **post-event mapping** and inventory building.
- **Earthquake-triggered landslides have zero lead time by physics.** We do rapid
  post-event mapping instead, and never claim coseismic prediction.

---

## Team

| Person | Role | Owns folder |
|---|---|---|
| **Vishwajeet** | Team lead, backend, integration | `backend/`, `docs/`, `data/sample/`, `docker-compose.yml` |
| **Rudra** | ML / AI | `ml/` |
| **Riya** | Frontend (React) | `frontend/` |

**Stay in your own folder.** Shared files are edited by Vishwajeet only — ask him.
See [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md).

---

## Tech stack

**Backend** — Python 3.11, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2.0,
GeoAlchemy2, Alembic, APScheduler, pytest
**Database** — PostgreSQL 16 + PostGIS 3.4 (via Docker Compose)
**Frontend** — React.js (Vite), MapLibre GL JS, Tailwind CSS, Recharts,
TanStack Query, Dexie/IndexedDB, Workbox
**ML** — LightGBM, scikit-learn, PyTorch, SHAP, Ultralytics YOLO
**Geospatial** — GDAL, rasterio, rioxarray, xarray, geopandas, shapely, pyproj,
WhiteboxTools

> **Python 3.11 only.** Do **not** use 3.14 — compiled geospatial packages
> (GDAL, rasterio, geopandas) have no pre-built wheels for it yet, and pip will
> try to compile GDAL from source on Windows, which fails.

---

## Setup

### 1. Install Miniforge (once)

```bash
winget install CondaForge.Miniforge3
```

Then open **Miniforge Prompt** and enable conda in Git Bash:

```bash
conda init bash
```

Close and reopen your terminal.

### 2. Create the environment

```bash
conda env create -f environment.yml
conda activate landslide
```

Verify:

```bash
python -c "import rasterio, geopandas, shapely, pyproj; print('ok')"
```

**Run `conda activate landslide` in every new terminal.** If you forget, you get
the wrong Python and GDAL warnings.

### 3. Start the database

```bash
docker compose up -d
```

### 4. Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs

### 5. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Repository layout

```
landslide-platform/
├── backend/            FastAPI, database, APIs, alert workflow  (Vishwajeet)
│   ├── app/
│   │   ├── api/v1/     REST endpoints
│   │   ├── core/       auth, RBAC, audit, CRS utilities
│   │   ├── db/         SQLAlchemy models, migrations
│   │   ├── ingest/     rainfall, soil moisture, imagery
│   │   ├── terrain/    DEM, slope units, attributes
│   │   ├── hydrology/  three-tank model, critical line
│   │   ├── ml/         model serving, calibration, explainability
│   │   ├── runout/     angle of reach
│   │   ├── exposure/   intersection, chainage
│   │   └── alerting/   CAP XML, templates, authorisation
│   └── tests/
├── ml/                 notebooks and experiments               (Rudra)
├── frontend/src/       React dashboard and citizen PWA         (Riya)
├── data/sample/        mock JSON so everyone can work parallel
├── docs/               architecture, API contract, steps, git workflow
└── docker-compose.yml
```

---

## Documentation

| File | What is in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system design, tech-stack rationale, DB schema, evaluation method |
| [docs/IMPLEMENTATION_STEPS.md](docs/IMPLEMENTATION_STEPS.md) | Step-by-step build plan (V0–V14, R1–R8, F1–F8) |
| [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) | Branching, commits, conflict rules |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | Fixed JSON formats between ML → backend → frontend |
| [data/README.md](data/README.md) | Data sources, licences, citations |

---

## Honesty rules (non-negotiable)

These are enforced in the code and database, not only in documentation.

1. **Nothing is auto-confirmed.** Every prediction starts at `PENDING_VERIFICATION`.
2. **No automatic public alert.** A named human authorises; the action is recorded
   in an append-only audit log. A database `CHECK` constraint makes it impossible
   to dispatch an alert with no authoriser.
3. **Risk is never derived from probability alone.** Risk = likelihood × consequence.
4. **Never fabricate** satellite data, coordinates, population figures, or shelter
   locations.
5. **Wording:** "estimated potentially exposed population", not "N people affected".
   "Road potentially affected", not "road blocked" — unless a field report confirms it.
6. **Simulated sensor data carries a visible `SIMULATED` badge** in the UI.
7. **No accuracy claims without measurement.** We report POD, FAR, CSI, Brier score
   and lead-time distribution — never bare "accuracy", which is meaningless for
   rare events.
8. **No uncited number** goes into a presentation.

---

## Scope boundaries (deliberate)

| Not built | Why |
|---|---|
| Earthquake landslide prediction | Zero lead time by physics. We do rapid post-event SAR mapping instead |
| GLOF / glacial lake outburst | Different hazard chain (lake monitoring → breach → flood routing). Our impact and alerting layer is reusable for its flood polygon |
| Wind as a trigger | Windthrow is marginal; cyclone *rainfall* is the trigger, handled as a low-antecedent-moisture regime |
| Deep-seated slow deformation | Needs multi-year InSAR/GNSS; C-band decorrelates under dense canopy |
| Direct public warning issuance | IMD is the sole legal issuer of weather warnings; SDMA/DDMA issue disaster alerts |

The downstream half of the system — slope-unit registry, exposure intersection,
decision card, CAP alerting, audit log — is deliberately **hazard-agnostic**.
