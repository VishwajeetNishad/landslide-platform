# IMPLEMENTATION STEPS — Step-by-Step Process
## Landslide Early Warning Platform | Team: Vishwajeet, Rudra, Riya

**Version:** 1.0 (planning only — koi code likha nahi gaya)
**Date:** 2026-09-02
**Rule:** Ek time par ek step. Confirm hone se pehle next step shuru nahi.

---

## 0. Is document ko kaise use karna hai

- Har step ka ek **ID** hai: `V` = Vishwajeet (backend), `R` = Rudra (ML), `F` = Riya (frontend), `I` = Integration checkpoint.
- Baat karte waqt ID use karo: *"V3 done hai, V4 par aa raha hoon"*. Isse confusion nahi hoga.
- Har step mein 5 cheezein hain: **KYA / KYUN / TEST / DONE JAB / TIME**.
- **Detailed code kisi step mein nahi hai** — jaan-boojh kar. Code tab likhenge jab us step par pahunchenge. Ye document sirf *raasta* hai, *manzil* nahi.

### Definition of Done (§23 se) — ye har step par lagu hai

Task "done" nahi hota sirf code likhne se. Done ka matlab:

```
Code likha  +  Test chala  +  Expected output mila  +  Doc update hua  +  Agla banda use kar sakta hai
```

---

## 1. Current system status (aaj check kiya, 2026-09-02)

| Cheez | Status | Action |
|---|---|---|
| `conda` | ❌ nahi hai | **V0 mein install karna hai** |
| Python | ⚠️ 3.14.3 only | **Use NAHI karenge** — geo packages toot jaayenge |
| `winget` | ✅ v1.29.290 | Miniforge isse install hoga |
| Miniforge3 | ✅ available (`CondaForge.Miniforge3`) | V0 |
| `git` | ✅ 2.51.0 | ready |
| Docker Desktop | ❓ check nahi kiya | **V3 mein check karenge** |
| `docs/` folder | ✅ exists | `ARCHITECTURE.md` andar hai |
| Research PDFs | ✅ P1–P3, dossier, PPT template | ready |

> ### ⚠️ Sabse pehla blocker
> Tumne socha tha Step 1 = FastAPI setup. Lekin **conda install nahi hai aur Python 3.14 hai**.
> `rasterio`, `GDAL`, `geopandas` ye **compiled packages** hain (C++ mein likhe hue, Python ke liye wrapper). Naye Python version ke liye inke ready-made "wheels" (pre-built installers) mahino baad aate hain. Wheel na mile toh `pip` GDAL ko source se compile karne lagta hai — Windows par ye **fail ho jaata hai ya ghanton lagta hai**.
> Isiliye asli Step 1, **Step V0** hai. Ye skip nahi kar sakte.

---

## 2. Dependency map — kaun kis par atka hai

Sabse important diagram. Isse pata chalega ki kaun bina rukey kaam kar sakta hai.

```
                            V0  Environment
                                    │
                  ┌─────────────────┼─────────────────┐
                  v                 v                 v
            V1 Repo + Git     R1 ML env         F1 React setup
                  │                 │                 │
                  v                 v                 v
            V2 Fastify hello   R2 DEM download   F2 MapLibre blank map
                  │                 │                 │
                  v                 v                 │
            V3 Docker+PostGIS  R3 Slope units          │
                  │                 │                 │
                  v                 │                 │
            V4 DB schema            │                 │
                  │                 │                 │
                  └────────┬────────┘                 │
                           v                          │
                    V5 Load slope units into DB       │
                           │                          │
                           v                          │
                    V6 GeoJSON API  ─────────────────>┤
                           │                          │
                    ╔══════╧══════════════════════════╧══════╗
                    ║  I1  CHECKPOINT — Day 1 end            ║
                    ║  Map par asli Aizawl slope units       ║
                    ╚══════╤══════════════════════════╤══════╝
                           │                          │
              ┌────────────┼────────────┐             │
              v            v            v             │
        R4 Rainfall   R5 Tank SWI   R6 Suscept.       │
              └────────────┼────────────┘             │
                           v                          │
                    R7 Runout + Exposure              │
                           v                          │
                    R8 ML JSON output                 │
                           │                          │
                           v                          │
                    V7 Ingest ML JSON                 │
                           v                          │
                    V8 Risk logic                     │
                           v                          │
                    V9 Risk/Exposure API ────────────>┤
                                                       v
                                              F3 Risk heatmap
                                              F4 Risk detail card
                    ╔══════════════════════════════════════════╗
                    ║  I2  CHECKPOINT — Day 2 end              ║
                    ║  Rainfall → ML → API → Dashboard         ║
                    ╚══════════════════════════════════════════╝
                           │                          │
              V10 Auth/RBAC                    F5 Snake line chart
              V11 Verification API             F6 Review queue
              V12 Alert state machine          F7 Decision card
              V13 Audit log                    F8 Citizen PWA
              V14 CAP XML + mock SMS
                    ╔══════════════════════════════════════════╗
                    ║  I3  CHECKPOINT — Day 3, FINAL DEMO      ║
                    ╚══════════════════════════════════════════╝
```

### 🔑 The most important rule: MOCK DATA FIRST

Diagram mein dikh raha hai ki Riya `V6` par atak sakti hai, aur tum `R8` par. **Aisa nahi hona chahiye.**

**Solution:** `V1` ke turant baad, main tumse bolunga ki `data/sample/` folder mein **teen mock JSON files** likho:
- `mock_slope_units.geojson` — 5 fake polygons
- `mock_ml_output.json` — Rudra ka expected output format
- `mock_risk_api_response.json` — Riya ko jo API dega

**Faayda:** Riya asli slope units ka wait nahi karegi — mock GeoJSON se map banayegi. Rudra ka model chalne se pehle tum API bana lenge. **Teeno parallel chalenge.** Ye tumhara sabse bada team-lead lever hai.

Hinglish mein: *mock data = nakli data jo shakal mein asli jaisa ho. Isse har banda apna hissa bana sakta hai bina doosre ka intezaar kiye.*

---

# PART A — VISHWAJEET (Backend + Integration)

## V0 — Python 3.11 environment banao ⏱️ ~60–90 min | RISK: HIGH

**KYA:** Miniforge install karo (`winget install CondaForge.Miniforge3`), phir `landslide` naam ka conda environment banao Python 3.11 ke saath, aur usme saare geo packages daalo.

**KYUN:**
- *Conda kya hai?* Ek package manager jo sirf Python libraries nahi, **C/C++ libraries bhi** install karta hai. GDAL ek C++ library hai. `pip` usko theek se handle nahi kar paata Windows par. `conda-forge` channel se ready-made compiled version milta hai — 5 minute mein, bina compile kiye.
- *Environment kya hai?* Ek alag-thalag dabba jisme ek specific Python version aur uski libraries rehti hain. Isse tumhara system Python 3.14 chhedhna nahi padega, aur teeno team members ka setup same rahega.
- **Ye pehla step hai kyunki iske bina koi bhi geo code nahi chalega.**

**TEST:** Naya terminal kholo → `conda activate landslide` → `python --version` (3.11.x aana chahiye) → phir ek-ek import karke dekho: `import rasterio, geopandas, shapely, pyproj`.

**DONE JAB:** Saare imports bina error chalein aur Python 3.11.x dikhe.

**Common errors jo aayenge:** `conda: command not found` (naya terminal kholna padta hai, ya PATH mein add karna padta hai) · install atak jaana (conda-forge dheere hota hai, patience) · Windows par PowerShell mein `conda activate` fail hona (`conda init` chalana padta hai).

---

## V1 — Repository structure + Git ⏱️ ~30 min | RISK: LOW

**KYA:** `landslide-platform/` ki poori folder structure banao (§6 ke hisaab se), `git init`, `.gitignore` (data aur secrets ignore karo), `README.md`, aur **teen mock JSON files** `data/sample/` mein.

**KYUN:** Structure pehle se fix ho toh Rudra aur Riya ko pata rahega file kahan rakhni hai. Aur mock files ke bina teeno parallel kaam nahi kar sakte (upar §2 dekho). `.gitignore` mein `data/` daalna zaroori hai — DEM files bahut badi hoti hain, GitHub reject kar dega.

**TEST:** `git status` clean dikhe (ya sirf intended files). `data/sample/` ki teen files exist karein aur valid JSON hon.

**DONE JAB:** Rudra aur Riya repo clone karke apna kaam shuru kar sakein.

---

## V2 — Node backend "hello world" chalao ⏱️ ~45 min | RISK: LOW ✅ DONE

> **Faisla badla:** shuru mein backend Python/FastAPI socha tha. V2 par pahunch kar
> Node.js chuna. **Kyun:** backend ka kaam mostly HTTP + JSON + SQL hai — spatial
> kaam **PostGIS ke andar** hota hai, API layer sirf query bhejta hai. Node lene se
> Vishwajeet aur Riya ek hi language mein aa gaye. Raster ka kaam (runout) Rudra ke
> `ml/` mein chala gaya, jahan woh waise bhi behtar hai.
>
> **`docs/API_CONTRACT.md` mein ek line nahi badli** — JSON language-agnostic hai.
> Contract pehle likhne ka yahi fayda hai.

**KYA:** `backend/package.json`, `src/core/config.js` (settings), `src/app.js`
(app banata hai), `src/server.js` (app chalata hai), `src/routes/meta.js`
(`/` aur `/health`), `test/meta.test.js` (6 test).

**KYUN:**
- *Fastify kya hai?* Node framework jisse hum ML ka result API ke through frontend tak bhejenge. Express se tez hai aur **schema-first** hai — route par likha JSON schema hi validation bhi hai aur documentation bhi.
- *`/docs` kya hai?* Route schemas se **khud-ba-khud** interactive API documentation page ban jaata hai. Riya bina Vishwajeet se poochhe koi bhi endpoint browser mein test kar sakti hai — aur demo mein bhi impressive lagta hai.
- *`app.js` aur `server.js` alag kyun?* `app.js` app **banata** hai par port par sunta nahi. Test usko `app.inject()` se seedha bulata hai — koi port, koi network nahi, millisecond mein chalta hai. `server.js` alag hai jo `.listen()` karta hai. Isko **app factory pattern** kehte hain.
- *CORS kya hai?* Browser ka rule: `localhost:5173` (Riya) `localhost:8000` (API) se data nahi maang sakti, kyunki port alag hai. Ye **#1 cheez hai jispar frontend-backend integration atakta hai** — isliye pehle din laga diya.
- *`/health` mein `database: not_configured` kyun?* Kyunki DB abhi laga hi nahi (V3 mein aayega). Jhootha `"ok"` sabse khatarnaak jawab hai — Docker khush rahega, monitoring khush rahegi, aur API har request par crash hoga.

**TEST:**
```bash
cd backend && npm test          # 6 pass hone chahiye
npm run dev                     # phir browser mein:
```
`http://127.0.0.1:8000` (JSON), `http://127.0.0.1:8000/health`, `http://127.0.0.1:8000/docs` (Swagger UI)

**DONE JAB:** ✅ 6/6 test pass, teeno URL kaam kar rahe, CORS header dikh raha,
`npm audit` par 0 vulnerabilities.

---

## V3 — Docker Compose + PostgreSQL/PostGIS ⏱️ ~60–90 min | RISK: MEDIUM

**KYA:** Pehle Docker Desktop check/install karo, phir `docker-compose.yml` likho jisme `db` (PostGIS image) aur `redis` services hon. Container chalao aur PostGIS extension enable karo.

**KYUN:**
- *PostgreSQL* = database. *PostGIS* = uska add-on jo usko **naksha samajhne wala** bana deta hai. Iske bina "is polygon ke andar kitne ghar hain?" ye sawaal poochna hi mumkin nahi.
- *Docker kyun?* Bina Docker, PostGIS Windows par manually install karna dukhdayi hai. Docker ek chhota pre-configured Linux dabba deta hai jisme sab already set hai. Aur `docker-compose up` se Rudra/Riya ke laptop par bhi **exactly same** database chalega.

**TEST:** `docker compose up -d` → `docker compose ps` (dono running) → DB ke andar jaake `SELECT PostGIS_Version();` chalao.

**DONE JAB:** PostGIS version number return kare.

**Common errors:** Docker Desktop start nahi hona (WSL2 enable karna padta hai) · port 5432 already in use (koi purana Postgres chal raha hai) · pehli baar image download slow hona (~600 MB).

---

## V4 — Database schema + SQL migrations ⏱️ ~90 min | RISK: MEDIUM

**KYA:** `backend/migrations/` mein numbered `.sql` files likho (`001_extensions.sql`, `002_core_tables.sql`, …) aur ek chhota `migrate.js` runner banao jo unhe order mein chalaye aur `schema_migrations` table mein likhta jaaye ki kaun-kaunsi chal chuki hai. Shuruaat mein sirf 4 tables: `district`, `slope_unit`, `forecast_run`, `prediction`. Baaki baad mein.

**KYUN:**
- *Migration kya hai?* Database ka "version control" — jaise git code ke liye. Jab tum table badloge, ek nayi numbered file banegi aur Rudra/Riya ek command (`npm run migrate`) se apna DB update kar lenge. Sabka DB same rehta hai.
- *ORM kyun NAHI le rahe?* ORM (Python mein SQLAlchemy, Node mein Prisma/Drizzle) SQL ko chhupa deta hai. Hamara schema PostGIS-heavy hai — `geometry(Polygon,4326)` columns, GiST spatial index, aur `CHECK` constraints. Ye teen cheezein har ORM mein "escape hatch" se raw SQL likhkar hi hoti hain. Toh abstraction ka fayda kuch nahi, sirf ek extra dependency aur ek extra cheez jo toot sakti hai. Seedha SQL likhna kam kaam hai **aur** viva mein padhkar dikhane layak hai.
- *Query kaise chalegi?* `postgres` package (ek hi dependency) se — tagged template literals, jo automatically parameterise karke SQL injection rokte hain.
- **Yahan sabse important baat:** `probability`, `risk_level`, aur `verification_status` — teen **alag columns**. Risk ko probability se calculate karke store nahi karenge. Aur `verification_status` ka default `PENDING_VERIFICATION` hoga. Ye tumhare project ka core scientific rule hai, aur hum isko **database mein hi enforce** karenge, sirf doc mein likhkar nahi.

**TEST:** `npm run migrate` → `psql` mein `\dt` se tables dikhein → `\d slope_unit` mein `geom` column ka type `geometry(Polygon,4326)` ho → migration **dobara** chalao, "already applied, skipping" bole (idempotent).

**DONE JAB:** Tables ban gaye, geometry column ka type sahi hai, aur migration dobara chalane par kuch nahi tootta.

---

## V5 — Slope units database mein load karo ⏱️ ~45 min | RISK: LOW

**KYA:** Ek script jo Rudra ki slope-unit file (GeoJSON/Shapefile) padhe aur PostGIS mein daale. Agar `R3` ready nahi hai toh **mock GeoJSON** use karo.

**KYUN:** Ye tumhara aur Rudra ka pehla asli integration point hai. Aur `data/sample/mock_slope_units.geojson` se karke tum Rudra ka wait nahi karoge — yahi "mock first" rule hai action mein.

**TEST:** `SELECT id, ST_Area(geom::geography)/10000 AS ha FROM slope_unit LIMIT 5;` — sensible hectare values aane chahiye.

**DONE JAB:** Rows DB mein hain aur area reasonable dikh raha hai.

**Yahan ek CRS trap hai:** `ST_Area` seedha `EPSG:4326` par lagana **galat** hai — degrees ka square milega, meter nahi. Isliye `::geography` cast (ya UTM `EPSG:32646` mein reproject). Ye `ARCHITECTURE.md §8` ka rule hai aur ek badhiya viva question bhi.

---

## V6 — Pehla asli API: slope units GeoJSON ⏱️ ~45 min | RISK: LOW

**KYA:** `GET /api/v1/districts/{id}/slope-units` — PostGIS se polygons padhkar GeoJSON FeatureCollection return karo.

**KYUN:** Ye **Riya ka pehla asli data source** hai. Iske baad woh mock se hatkar asli API par shift ho sakti hai. *GeoJSON* = naksha data ka standard JSON format, jo MapLibre seedha samajh leta hai.

**TEST:** `/docs` se endpoint chalao. Response ko [geojson.io](https://geojson.io) par paste karo — Aizawl ke upar polygons dikhne chahiye.

**DONE JAB:** Riya ke React app mein ye polygons render ho jaayein.

> ## ⛳ CHECKPOINT I1 — Day 1 khatam
> **Test:** Riya ka React app khulta hai, MapLibre map dikhta hai, aur **tumhare Node API se aaye asli Aizawl slope-unit polygons** us map par hain. Click karne par PostGIS se attributes aate hain.
> **Ye pass nahi hua toh Day 2 shuru nahi karna.** Pehle isko theek karo.

---

## V7 — ML output ingest karo ⏱️ ~60 min | RISK: MEDIUM

**KYA:** `POST /api/v1/predictions/ingest` — Rudra ka JSON leke **Fastify ke JSON Schema** se validate karo aur `forecast_run` + `prediction` tables mein store karo.

**KYUN:** *JSON Schema* = data ka darban. Route ke saath ek `body` schema lagta hai (`type`, `required`, `minimum`, `maximum`), aur Fastify request ko route ke andar ghusne se **pehle** hi check kar leta hai. Galat shakal ka JSON aaya toh saaf error dega, chupchaap galat data DB mein nahi jaayega. Bonus: wahi schema `/docs` mein khud documentation ban jaata hai — ek jagah likho, do kaam.

> ⚠️ **Ek gotcha jo yaad rakhna:** Fastify schema fail hone par **400** deta hai, par hamara `API_CONTRACT.md` **422** bolta hai. 422 semantically sahi hai — JSON valid hai, matlab galat hai. Isliye V7 mein `schemaErrorFormatter` lagakar status 422 karna hoga. Agar ye nahi kiya toh Riya ka error handling contract se match nahi karega.

`forecast_run.input_cutoff_ts` bhi store karo — isse pata rahega ki model ne kaunsa data dekha tha, jo hindcast demo ke liye zaroori hai (§18.4).

**TEST:** `data/sample/mock_ml_output.json` `/docs` se POST karo → DB mein row aaye → phir jaan-boojh kar `probability: 1.5` bhejo → **422 error** aana chahiye.

**DONE JAB:** Valid JSON store ho, invalid reject ho.

---

## V8 — Risk level logic ⏱️ ~45 min | RISK: LOW

**KYA:** `risk_level(probability, exposure)` function — probability **aur** exposure dono se `LOW/MEDIUM/HIGH` nikaalo. `ARCHITECTURE.md §13` ka matrix use karo. Iske unit tests likho.

**KYUN:** **Ye tumhare poore project ka sabse important 20 lines ka code hai.** Risk = Likelihood × Consequence. Sirf probability se risk nahi banta.

Do example jo test mein hone chahiye:
- `probability 0.95` par khaali jungle wali dhalaan, neeche kuch nahi → **LOW risk** ✅
- `probability 0.72` par school ke upar wali dhalaan → **HIGH risk** ✅

Dono valid hain. Judge ye zaroor poochega, aur ye tumhara scientific credibility hai.

**TEST:** `pytest` — dono cases pass hon.

**DONE JAB:** Tests green.

---

## V9 — Risk + Exposure APIs ⏱️ ~60 min | RISK: LOW

**KYA:** `GET /risk/current`, `GET /risk/forecast`, `GET /roads/status`, `GET /response/priority` — requirement (f1) se (f4) tak.

**KYUN:** Ye Riya ke dashboard ke chaar panel feed karte hain. Response mein wording bahut sochkar rakho: `estimated_potentially_exposed_population`, `road_potentially_affected` — bilkul `"people_affected"` ya `"road_blocked"` nahi. Field ka **naam hi** honesty enforce karega, kyunki Riya jo field name dega wahi screen par dikhega.

**TEST:** Chaaron endpoint `/docs` se chalein aur sahi shape ka JSON dein.

**DONE JAB:** Riya ke dashboard mein numbers dikh rahe hon.

> ## ⛳ CHECKPOINT I2 — Day 2 khatam
> **Test:** Rainfall data daalo → Rudra ka model chale → JSON tumhare API mein aaye → DB mein store ho → Riya ke dashboard par risk heatmap update ho jaaye.
> **Ye end-to-end chain hai. Yahi asli prototype hai.** Iske baad sab polish hai.

---

## V10 — Auth: JWT + RBAC ⏱️ ~90 min | RISK: MEDIUM

**KYA:** `POST /auth/login` JWT token de, chaar roles (`SUPER_ADMIN`, `DISTRICT_ADMIN`, `FIELD_OFFICER`, `CITIZEN`), aur district-wise data scoping.

**KYUN:** *JWT* = login ke baad mila ek signed digital pass, jo har request ke saath jaata hai. *RBAC* = Role-Based Access Control — kaun kya dekh sakta hai. Requirement hai ki Aizawl ka admin Sikkim ka data na dekh paaye.

**TEST:** Aizawl admin ke token se Sikkim data maango → **403 Forbidden** aana chahiye. Ye **negative test** zaroor likho — sirf "kaam kar raha hai" test karna kaafi nahi, "block ho raha hai" bhi test karna hai.

**DONE JAB:** Negative test pass ho.

---

## V11 — Verification workflow ⏱️ ~45 min | RISK: LOW

**KYA:** `PATCH /predictions/{id}/verification` — sirf authorized human `PENDING_VERIFICATION` → `CONFIRMED` / `FALSE_POSITIVE` / `NEEDS_REVIEW` kar sake. Har change audit log mein jaaye.

**KYUN:** Ye tumhara core rule hai: **koi prediction khud-ba-khud confirm nahi hoti.** Ye endpoint us rule ko asli banata hai. Model ka probability yahan **badalta nahi** — sirf verification status badalta hai. Do alag cheezein.

**TEST:** Status change karo → DB mein `verified_by` aur `verified_at` bharein → `audit_log` mein entry aaye.

**DONE JAB:** Human decision record ho raha hai, aur probability chhua bhi nahi gaya.

---

## V12 — Alert state machine + authorization gate ⏱️ ~90 min | RISK: MEDIUM

**KYA:** `DRAFT → PENDING_AUTHORISATION → AUTHORISED/REJECTED/EXPIRED → DISPATCHED` state machine, `POST /alerts/{id}/authorise` aur `/reject` (reason mandatory).

**KYUN:** **Ye tumhare project ki sabse zaroori safety feature hai.** System alert *taiyaar* kar sakta hai, par bhej nahi sakta — jab tak koi naam-wala insaan authorize na kare. Aur hum isko database `CHECK` constraint se lock karenge, taaki **code mein bug ho toh bhi** bina authorizer alert dispatch na ho paaye.

Ye limitation nahi, **feature** hai: jo system khud alert bhej sakta hai, usko koi state government install nahi karegi.

**TEST:** Bina authorise kiye seedha `DISPATCHED` karne ki koshish karo → **DB constraint error** aana chahiye.

**DONE JAB:** Gate bypass ho hi na sake.

---

## V13 — Audit log ⏱️ ~30 min | RISK: LOW

**KYA:** Append-only `audit_log` table + ek reusable helper jo har important action record kare (kaun, kab, kya, pehle-kya-tha, ab-kya-hai).

**KYUN:** *Append-only* = sirf naya add ho sakta hai, purana edit/delete nahi. Ye accountability ke liye hai — koi bol nahi sakta "maine authorize nahi kiya tha". Government deployment mein ye non-negotiable hota hai.

**TEST:** Verification aur authorization dono ke baad audit rows check karo. `UPDATE` maar kar dekho → fail hona chahiye.

**DONE JAB:** Log immutable hai.

---

## V14 — CAP XML + mock SMS ⏱️ ~60 min | RISK: LOW

**KYA:** `GET /alerts/{id}/cap.xml` — CAP 1.2 standard XML jisme runout polygon geo-scoped ho. Plus mock SMS dispatcher (DB mein likhe, UI mein dikhe) teen frozen templates ke saath (Mizo/Hindi/English).

**KYUN:** *CAP* = Common Alerting Protocol, alerts ka international standard. CAP nikaalne ka matlab hum government ke existing pipes (SACHET) mein plug ho sakte hain, apna alag channel banane ke bajaye. Ye judge ko batata hai ki tumne deployment socha hai.

**Template rule:** slots bharo, prose generate mat karo. Galat translate hui warning kisi ki jaan le sakti hai — isliye LLM se free-form alert text kabhi nahi.

**TEST:** XML validate karo, teeno languages dekho.

**DONE JAB:** Valid CAP XML aur teen SMS previews.

> ## ⛳ CHECKPOINT I3 — Day 3, FINAL DEMO
> Poori kahani ek baar mein chale: Aizawl → rainfall badhi → SWI badha → snake line critical curve cross ki → slope units highlight → probability → runout → exposure → risk level → admin ko decision card dikha → verification → human authorise → alert + CAP XML + SMS preview.
> **Do baar rehearsal karo. Ye cut nahi hoga.**

---

# PART B — RUDRA (ML/AI) — summary track

| ID | Kaam | Time | Risk | Output kisko |
|---|---|---|---|---|
| **R1** | Conda env (V0 jaisa) + LightGBM, PyTorch, SHAP | 60 min | HIGH | — |
| **R2** | Copernicus DEM download (Aizawl) + slope/aspect/curvature | 90 min | LOW | — |
| **R3** | **Slope units** — WhiteboxTools chain (§10.2) | 180 min | **MED** | → V5 |
| **R4** | Rainfall ingest (GPM IMERG + ECMWF) per slope unit | 150 min | **MED** | → R5 |
| **R5** | **Three-Tank SWI Stage A** (fixed params) | 120 min | LOW | → R6, F5 |
| **R6** | Susceptibility LightGBM (slope-matched negatives!) | 180 min | **HIGH** | → R8 |
| **R7** | Runout (angle of reach) + exposure intersect | 180 min | MED | → R8 |
| **R8** | Final ML JSON output (fixed format) | 60 min | LOW | → V7 |

**Rudra ko din 1 par bolna:**

> **R3 sabse pehle karo, aur 3 ghante ka timebox lagao.** Stream threshold tune karna fiddly hai. 3 ghante mein na ho toh simple watershed basins par shift ho jao (hillslope split ke bina) — chalega. **Aur jaise hi slope units ban jaayein, foran Vishwajeet ko GeoJSON bhejo** — kyunki Riya aur main dono uska wait kar rahe hain.

**R5 (Tank model) ki khaas baat:** Stage A ko **training data ki zarurat hi nahi hai** — literature ke fixed parameters se chalta hai, ~20 lines ka code. **Isiliye 3-din ka prototype possible hai.** Ye pehle banao, Stage B (LightGBM) baad mein, Stage C (learnable) sirf agar time bache. Teeno ko ek **ablation table** mein dikhana sirf Stage C dikhane se zyada impressive hai.

**R6 ka sabse bada trap:** negative examples **slope-matched** hone chahiye. Agar flat valley se negatives uthaye, toh model seekh lega "steep = landslide", AUC 0.95 dikhayega, aur bilkul bekaar hoga. Ye woh galti hai jo published papers mein bhi ho jaati hai.

---

# PART C — RIYA (React Frontend) — summary track

| ID | Kaam | Time | Risk | Input kahan se |
|---|---|---|---|---|
| **F1** | React (Vite) + Tailwind + TanStack Query setup | 60 min | LOW | — |
| **F2** | MapLibre blank map, Aizawl par centred | 60 min | LOW | — |
| **F3** | Slope-unit layer + risk heatmap colouring | 120 min | MED | V6, V9 |
| **F4** | Risk detail card (click par) | 90 min | LOW | V9 |
| **F5** | **Snake line chart** (Recharts) | 120 min | MED | R5 |
| **F6** | Review queue table + verify buttons | 90 min | LOW | V11 |
| **F7** | **Decision card** + authorise/reject | 120 min | MED | V12 |
| **F8** | Citizen PWA — camera, GPS, Dexie offline queue | 150 min | MED | V-later |

**Riya ko din 1 par bolna:**

> **Note: hum Next.js NAHI, React.js use kar rahe hain — Vite ke saath.** F1 aur F2 ke liye tumhe backend ka wait karne ki zarurat nahi. `data/sample/mock_slope_units.geojson` se map bana lo. Jab V6 ready hoga, sirf data source ka URL badalna hoga — baaki code same rahega.
>
> **F5 (snake line) aur F7 (decision card) sabse important hain.** Demo mein ye do cheezein hi judge ko convince karengi. Inko time do, polish par baad mein aana.

**F3 ke wording rules (§18):** UI par likhna hai `"estimated potentially exposed population: ~120"` — **kabhi** `"120 people affected"` nahi. Aur `"road potentially affected"` — `"road blocked"` nahi, jab tak field report confirm na kare. Aur agar sensor data simulated hai toh screen par **`SIMULATED` badge** dikhna chahiye. Ye rules API field names mein bhi built-in honge, taaki galti karna mushkil ho.

---

## 3. Time summary

| Person | Day 1 | Day 2 | Day 3 | Total |
|---|---|---|---|---|
| **Vishwajeet** | V0–V6 ≈ 6 h | V7–V9 ≈ 3 h | V10–V14 ≈ 5.5 h | **~14.5 h** |
| **Rudra** | R1–R3 ≈ 5.5 h | R4–R7 ≈ 10.5 h | R8 + polish ≈ 3 h | **~19 h** |
| **Riya** | F1–F2 ≈ 2 h | F3–F4 ≈ 3.5 h | F5–F8 ≈ 8 h | **~13.5 h** |

**Total ≈ 47 person-hours.** Teen logon mein ~16 ghante per banda, teen din mein — **matlab ~5.5 ghante roz.** Ho sakta hai, par tabhi jab V0/R1/F1 pehle ghante mein khatam ho jaayein aur scope creep na ho.

**Sach bolun toh:** Rudra ka load sabse zyada hai (~19 h). Day 2 par usko madad chahiye hogi. Tum V7–V9 jaldi khatam karke R7 (exposure intersection) mein haath laga sakte ho — woh PostGIS ka kaam hai, tumhara area hai.

---

## 4. Cut list — abhi decide karo, Day 3 ki raat 2 baje nahi

**Pehle ye kaato (isi order mein):**
1. Stage C learnable tank parameters
2. SAR / Sentinel-1 processing
3. Asli Bhashini API (3 hand-written frozen templates se kaam chala lo)
4. YOLO comparison run
5. BullMQ / Redis job queue (`node-cron` kaafi hai)
6. Seismic weakening term
7. UI polish

**Ye kabhi nahi kaatna:**
- Snake line
- Decision card
- Human authorization gate
- End-to-end integration (I2 checkpoint)
- Do rehearsals

---

## 5. Daily team ritual (§22)

**Subah 15 min:** Har banda bole — (1) kal kya khatam hua, (2) aaj kya karega, (3) kya blocker hai.

**Raat 15 min:** (1) kya *actually* chal raha hai, (2) screenshot dikhao, (3) integrated hai ya nahi, (4) kya atka hai.

**30–60 min se zyada koi atka:** task todo, ya mock data se aage badho. Kisi ko bekaar mein wait nahi karne dena — ye tumhara sabse bada team-lead kaam hai.

---

## 6. Ye document abhi bhi verify hona baaki hai

`ARCHITECTURE.md §24` mein 5 cheezein hain jo main confirm nahi kar saka (web search kaam nahi kiya is session mein). **Presentation se pehle inko khud verify karo.** Sabse important: GSI ka 2026 monsoon landslide-EWS coverage, aur NESAC koi landslide service chalata hai ya nahi. **Bina citation koi number slide par nahi jaayega.**

---

## 7. Agla kadam

**Step V0** — Miniforge install + Python 3.11 environment.

Confirm karo aur main V0 ke exact commands doonga, ek-ek karke, expected output ke saath. Abhi tak koi code likha nahi gaya, kuch install nahi kiya.
