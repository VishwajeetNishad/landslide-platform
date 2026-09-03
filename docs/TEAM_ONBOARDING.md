# TEAM ONBOARDING — Rudra aur Riya, yahi se shuru karo

**Landslide Early Warning Platform** | Team: Vishwajeet (lead/backend), Rudra (ML), Riya (Frontend)
**Version:** 1.0 · **Date:** 2026-09-03

> **Ye file kiske liye hai:** Rudra aur Riya ke liye. Repo clone karne ke baad
> **sabse pehle yahi padhna hai.** 15 minute lagenge, aur uske baad tumhe pata
> hoga: project kya hai, tumhara kaam kya hai, kahan likhna hai, aur **aaj kaunsi
> pehli command chalani hai.**
>
> Vishwajeet ke liye ye reference hai — kya-kya batana hai, ek jagah.

---

## 0. Pehle ye samajh lo — hum kya bana rahe hain (60 second)

North-East India ke liye **landslide early-warning platform**. Pilot district
**Aizawl, Mizoram**.

Ek line mein: **barish ka forecast dekhkar batao ki aaj raat kaunsi dhaal
(slope) gir sakti hai, aur uske neeche kaun hai — phir ek insaan se poochhkar
alert bhejo.**

```
Barish (observed + forecast)
        ↓
Three-Tank Soil Water Index      ← Rudra
        ↓
Failure probability               ← Rudra
        ↓
Runout + Exposure (kaun neeche hai) ← Rudra + PostGIS
        ↓
risk_level = probability × exposure  ← Vishwajeet (backend)
        ↓
Human verification                ← koi khud confirm nahi hota
        ↓
Decision card                     ← Riya (UI)
        ↓
Human authorisation               ← AI khud alert NAHI bhejta
        ↓
CAP 1.2 XML → SMS
```

**Teen shabd jo alag-alag hain aur kabhi mix nahi karne:**

| Cheez | Kaun deta hai | Example |
|---|---|---|
| `probability` | **model** (Rudra) | `0.72 (0.58–0.84)` |
| `risk_level` | **probability × exposure** (backend) | `HIGH` / `MEDIUM` / `LOW` |
| `verification_status` | **insaan** (officer) | `PENDING_VERIFICATION` |

Ye teen ek nahi hain. Poore project ka core yahi hai. Iska proof §5 mein hai.

---

## 1. Aath rules jo kabhi nahi todne (ye negotiable nahi hain)

Ye sirf documentation nahi hai — **code aur database mein enforce hote hain.**

1. **Kuch bhi apne aap confirm nahi hota.** Har prediction `PENDING_VERIFICATION`
   se shuru hoti hai.
2. **AI khud public alert nahi bhejta.** Ek **naam wala insaan** authorise karta
   hai. Database mein `CHECK` constraint hai jo bina authoriser ke dispatch
   hone hi nahi deta.
3. **Risk kabhi sirf probability se nahi banta.** Risk = likelihood × consequence.
4. **Kabhi fabricate mat karo** — satellite data, coordinates, population numbers,
   shelter locations. Number nahi pata toh `null` bhejo, andaaza mat lagao.
5. **Wording:** `"estimated potentially exposed population: ~120"` — **kabhi**
   `"120 people affected"` nahi. `"road potentially affected"` — `"road blocked"`
   nahi, jab tak field report confirm na kare.
6. **Simulated data par UI mein `SIMULATED` badge** dikhna chahiye.
7. **"Accuracy" kabhi report nahi karni.** POD / FAR / CSI / Brier score —
   rare events mein bare accuracy meaningless hoti hai.
8. **Bina citation koi number slide par nahi jaayega.**

**Kyun itna sakht?** Ye disaster management ka system hai. Galat alert = log
agli baar alert ignore karenge. Galat "safe" = koi mar sakta hai. Judge bhi
yahi poochhega — "aapka system galat hua toh?" Hamara jawab: *insaan beech
mein hai, aur log mein sab likha hai.*

---

## 2. Setup — pehle 30 minute (dono ke liye)

### 2.1 Repo clone karo

```bash
git clone https://github.com/VishwajeetNishad/landslide-platform.git
cd landslide-platform
```

> Repo **private** hai. Agar `Repository not found` aaye, matlab Vishwajeet ne
> abhi tumhe collaborator add nahi kiya — usko bolo.

### 2.2 Git mein apna naam set karo (ek baar)

```bash
git config user.name "Tumhara Naam"
git config user.email "tumhara@email.com"
```

> **Gotcha:** GitHub asli email push karne se rok sakta hai (`GH007` error).
> Tab GitHub → Settings → Emails se apna `xxxx+username@users.noreply.github.com`
> wala email uthao aur wahi set karo.

### 2.3 Ye 4 file padho (isi order mein)

| File | Kya milega | Kitna time |
|---|---|---|
| `docs/TEAM_ONBOARDING.md` | **ye file** — shuruaat | 15 min |
| `docs/API_CONTRACT.md` | **sabse important** — JSON ka exact shape | 20 min |
| `docs/GIT_WORKFLOW.md` | branch/commit/conflict rules | 10 min |
| `docs/IMPLEMENTATION_STEPS.md` | tumhare steps ki list (R1–R8 / F1–F8) | 10 min |

`docs/ARCHITECTURE.md` bada hai — **poora mat padho.** Zarurat par apna
section dekh lena.

---

## 3. Repo ka structure — kahan kya hai

```
landslide-platform/
├── backend/            Node.js API, DB, alert workflow      → VISHWAJEET
│   ├── src/
│   │   ├── server.js       port par listen karta hai
│   │   ├── app.js          app banata hai (listen nahi karta)
│   │   ├── routes/         HTTP endpoints
│   │   ├── core/           config, auth, RBAC, audit
│   │   ├── db/             schema, migrations, queries
│   │   ├── ingest/         rainfall, ML output lena
│   │   ├── exposure/       PostGIS intersection, chainage
│   │   └── alerting/       CAP XML, templates, authorisation
│   └── test/
│
├── ml/                 Python — model, terrain, tank        → RUDRA
│   ├── notebooks/          exploration
│   └── experiments/        run outputs
│
├── frontend/src/       React dashboard + citizen PWA        → RIYA
│   ├── dashboard/          risk map, cards, review queue
│   ├── components/         reusable UI
│   ├── citizen/            geo-tagged photo upload
│   ├── lib/                api client, helpers
│   └── offline/            Dexie queue, service worker
│
├── data/sample/        MOCK JSON — teeno yahan se shuru karte hain
├── docs/               saare documents
├── environment.yml     Rudra ka Python env (repo root par hai)
└── (docker-compose.yml — V3 mein banega, abhi nahi hai)
```

### Folder ownership — conflict rokne ka #1 trick

| Folder / File | Owner | Baaki log |
|---|---|---|
| `backend/` | **Vishwajeet** | haath nahi lagana |
| `ml/` | **Rudra** | haath nahi lagana |
| `frontend/` | **Riya** | haath nahi lagana |
| `docs/` | **Vishwajeet only** | badalna hai toh bolo |
| `data/sample/` | **Vishwajeet only** | badalna hai toh bolo |
| `docker-compose.yml`, `README.md`, `environment.yml` | **Vishwajeet only** | badalna hai toh bolo |

**Kyun kaam karta hai:** merge conflict tab hota hai jab **do log ek hi file ki
ek hi line** badlein. Teen log teen alag folder mein → Git ko decide karne ki
zarurat hi nahi → conflicts almost zero.

> `environment.yml` ka exception: Rudra ko koi package add karana ho toh
> **Vishwajeet ko bolo**, khud mat edit karo. Warna dono side se edit hoke
> conflict aayega.

---

## 4. 🔑 Sabse important rule: MOCK DATA FIRST

Ye samajh lo toh teen din bach jaayenge.

**Problem:** Riya ko slope units chahiye → woh Rudra ke R3 par atki hai.
Vishwajeet ko ML output chahiye → woh Rudra ke R8 par atka hai. Matlab do log
baithe rahenge jab tak Rudra khatam na kare. **3 din mein ye maut hai.**

**Solution:** `data/sample/` mein **teen mock file pehle se maujood hain** —
shakal mein bilkul asli jaisi, values nakli:

| File | Kya hai | Kaun use karega |
|---|---|---|
| `mock_slope_units.geojson` | 5 polygons Aizawl area par | **Riya** (map), Vishwajeet (V5) |
| `mock_ml_output.json` | Rudra ka expected output ka exact shape | **Rudra** (target), Vishwajeet (V7) |
| `mock_risk_api_response.json` | API Riya ko jo dega | **Riya** (poora dashboard) |

**Faayda:** teeno **aaj se** kaam shuru kar sakte hain, kisi ka wait kiye bina.
Jab asli cheez ready hogi, **sirf data ka source badlega — code nahi**, kyunki
shape same hai.

```js
// Aaj:
import risk from '../../data/sample/mock_risk_api_response.json';

// V9 ke baad — sirf ye line badlegi:
const risk = await fetch('/api/v1/risk/current?district=aizawl').then(r => r.json());
```

> Mock file ke andar `_comment` field hai jo saaf likhta hai ki data nakli hai,
> aur `meta.is_demo_data: true` hai. **Ye flag UI mein orange banner dikhata
> hai.** Isko hataana mana hai.

---

## 5. Sabse zaruri example — `AZ-1088`

`mock_ml_output.json` khol kar `AZ-1088` dekho:

| Field | Value |
|---|---|
| `probability` | **0.95** ← sabse zyada |
| `buildings_count` | 0 |
| `population_estimate` | 0 |
| `risk_level` | **LOW** ✅ |

Slope girne wali hai, par **neeche koi nahi hai.** Isliye risk LOW.

Agar `risk_level` seedha `probability` se banta, toh ye unit map par **RED**
dikhta, officer wahan team bhejta, aur us waqt `AZ-1142` — jahan 120 log aur
ek school hai — ignore ho jaata. **Yahi resource misallocation logon ki jaan
leta hai.**

**Isliye:**
- **Rudra `risk_level` NAHI bhejta.** Sirf `probability` bhejta hai.
- **Riya map ka rang `risk_level` se karti hai, `probability` se NAHI.**

Judge poochhega *"aapka risk model ka score hi hai na?"* — `AZ-1088` dikha dena.
Ye demo ka best 30 second hai.

---

## 6. 🧠 RUDRA — tumhara track

### Tumhara kaam ek line mein
Barish aur terrain se **per-slope-unit failure probability** nikaalna, aur usko
`mock_ml_output.json` ke **exact shape** mein JSON banakar dena.

### Steps

| ID | Kaam | Time | Risk | Output kisko |
|---|---|---|---|---|
| **R1** | Conda env + LightGBM, PyTorch, SHAP | 60 min | HIGH | — |
| **R2** | Copernicus DEM (Aizawl) + slope/aspect/curvature | 90 min | LOW | — |
| **R3** | **Slope units** — WhiteboxTools chain | 180 min | **MED** | → Vishwajeet V5 |
| **R4** | Rainfall ingest (GPM IMERG + ECMWF) per slope unit | 150 min | MED | → R5 |
| **R5** | **Three-Tank SWI Stage A** (fixed params) | 120 min | LOW | → R6, Riya F5 |
| **R6** | Susceptibility LightGBM (slope-matched negatives!) | 180 min | **HIGH** | → R8 |
| **R7** | Runout (angle of reach) + exposure | 180 min | MED | → R8 |
| **R8** | Final ML JSON output | 60 min | LOW | → Vishwajeet V7 |

### 🚀 Aaj tumhari pehli 3 commands (R1)

```bash
winget install CondaForge.Miniforge3
```

Ab **Miniforge Prompt** kholo (Start menu mein milega) aur ek baar ye chalao,
taaki `conda` Git Bash mein bhi kaam kare:

```bash
conda init bash
```

Terminal band karke dobara kholo, phir repo folder mein:

```bash
conda env create -f environment.yml && conda activate landslide
```

PyTorch alag se (jaan-boojh kar env file mein nahi hai — conda se bahut bada
download hota hai):

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

**Verify — ye pass hona chahiye:**

```bash
python -c "import rasterio, geopandas, shapely, pyproj, whitebox, lightgbm; print('R1 ok')"
```

Expected output: `R1 ok`

### ⚠️ Rudra ke liye 5 traps (har ek ne kisi na kisi ka din khaya hai)

**1. Python 3.14 kabhi nahi.** `environment.yml` mein `python=3.11` fix hai.
3.14 par GDAL/rasterio/geopandas ke pre-built wheels nahi hain → pip source se
compile karega → Windows par fail.

**2. Geo packages KABHI pip se nahi.** `gdal`, `rasterio`, `geopandas`,
`shapely`, `pyproj` — sirf conda se. Mix karne par `DLL load failed` aata hai
jo debug karna narak hai.

**3. Har naye terminal mein `conda activate landslide`.** Bhool gaye toh galat
Python milega aur ajeeb errors aayenge.

**4. R3 par 3 ghante ka timebox lagao.** Stream threshold tune karna fiddly
hai. 3 ghante mein na ho toh **simple watershed basins par shift ho jao**
(hillslope split ke bina) — chalega, demo ruk nahi sakta.

**5. R6 ka sabse bada trap — negatives slope-matched hone chahiye.** Agar flat
valley se negative examples uthaye, toh model seekh lega *"steep = landslide"*,
AUC 0.95 dikhayega, aur **bilkul bekaar** hoga. Ye galti published papers mein
bhi hoti hai.

### CRS rule (ye galti sabse mehngi padti hai)

| Kaam | CRS |
|---|---|
| Storage, API, web map | **EPSG:4326** |
| Area, distance, buffer | **EPSG:32646** (UTM 46N — Mizoram) |

**4326 degrees mein hai, metres mein nahi.** Usme area nikaaloge toh number
bilkul galat aayega aur error bhi nahi milega — bas chup-chaap galat. Sikkim ke
liye 32645.

### R5 ki khaas baat (ye pehle karo)

**Three-Tank Stage A ko training data ki zarurat hi nahi hai** — literature ke
fixed parameters se chalta hai, ~20 line ka code. **Isiliye 3-din ka prototype
possible hai.** Stage B (LightGBM) baad mein, Stage C (learnable params) sirf
agar time bache. Teeno ko ek **ablation table** mein dikhana sirf Stage C
dikhane se zyada impressive hai.

### Tum kya bhejte ho, kya NAHI bhejte

| ✅ Bhejo | ❌ Kabhi nahi bhejo |
|---|---|
| `probability` + `confidence_lower/upper` | `risk_level` |
| `susceptibility_score` | `verification_status` |
| `tank_state` (`s1_mm`, `s2_mm`, `s3_mm`, `swi_mm`) | bina band ka akela number |
| `drivers` (SHAP), `counterfactual` | bina `source_citation` ke `runout` |
| `input_cutoff_ts` | andaaze wale population numbers |

**`input_cutoff_ts` sabse important field hai.** Ye saabit karta hai ki model ne
future nahi dekha. Agar 3 September ki landslide predict karne ke liye 4
September ka rainfall use ho gaya, toh accuracy 99% aayegi aur **poori tarah
jhoothi** hogi. Isko **temporal leakage** kehte hain — ML papers reject hone ka
#1 kaaran.

### Output bhejne se pehle hamesha

```bash
python -m json.tool ml/experiments/output.json > /dev/null && echo OK
```

### Rudra ka Day 1 target

- [ ] R1 — env ban gaya, `R1 ok` print hua
- [ ] R2 — Aizawl ka DEM download, slope/aspect nikle
- [ ] **R3 — slope units ban gaye → GeoJSON foran Vishwajeet ko bhejo**

> **R3 sabse pehle nikaalo.** Riya aur Vishwajeet dono uska wait kar rahe hain.
> Jaise hi banta hai, WhatsApp par bhej do — perfect hone ka wait mat karo.

---

## 7. 🎨 RIYA — tumhara track

### Tumhara kaam ek line mein
`mock_risk_api_response.json` se **poora dashboard** bana lo. Live API baad mein
aayega — **shape exactly same rahega**, sirf `import` ki jagah `fetch` aayega.

> **Note: hum Next.js NAHI, React.js use kar rahe hain — Vite ke saath.**
> Koi App Router nahi, koi server component nahi. Plain React + Vite.

### Steps

| ID | Kaam | Time | Risk | Input kahan se |
|---|---|---|---|---|
| **F1** | React (Vite) + Tailwind + TanStack Query setup | 60 min | LOW | — |
| **F2** | MapLibre blank map, Aizawl par centred | 60 min | LOW | — |
| **F3** | Slope-unit layer + risk heatmap colouring | 120 min | MED | mock → V6/V9 |
| **F4** | Risk detail card (click par) | 90 min | LOW | mock → V9 |
| **F5** | **Snake line chart** (Recharts) | 120 min | MED | mock → R5 |
| **F6** | Review queue table + verify buttons | 90 min | LOW | V11 |
| **F7** | **Decision card** + authorise/reject | 120 min | MED | V12 |
| **F8** | Citizen PWA — camera, GPS, Dexie offline queue | 150 min | MED | baad mein |

**F5 (snake line) aur F7 (decision card) sabse important hain.** Demo mein yahi
do cheezein judge ko convince karengi. Inko time do, polish par baad mein aana.

### 🚀 Aaj tumhari pehli commands (F1)

`frontend/` folder repo mein **already hai** (khaali sub-folders ke saath), par
usmein abhi `package.json` nahi hai — woh tum banaogi.

Repo root se:

```bash
npm create vite@latest frontend -- --template react
```

> Vite poochhega: *"Target directory frontend is not empty…"*
> → **"Ignore files and continue"** chuno. Isse `src/dashboard/`,
> `src/citizen/` waale khaali folders bache rahenge.

```bash
cd frontend && npm install && npm run dev
```

Browser mein `http://localhost:5173` khulna chahiye — Vite ka default page.

**Ab Tailwind + baaki packages:**

```bash
npm install tailwindcss @tailwindcss/vite maplibre-gl recharts @tanstack/react-query
```

`vite.config.js` mein:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

`src/index.css` mein **sirf ye ek line** (baaki sab hata do):

```css
@import "tailwindcss";
```

> ⚠️ **Tailwind ka bada gotcha:** internet par 90% tutorials **Tailwind v3** ke
> hain, jo `npx tailwindcss init -p` aur `tailwind.config.js` + `postcss.config.js`
> bolte hain. **v4 mein woh command exist hi nahi karti** — error aayega. v4
> mein bas upar wala Vite plugin + ek `@import` line chahiye. Agar koi tutorial
> `@tailwind base;` bole, woh purana hai.

### 🗺️ F2 — MapLibre, Aizawl par

```bash
npm install maplibre-gl
```

```js
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';   // <-- ye line mat bhoolna
```

> ⚠️ **MapLibre ka #1 gotcha:** CSS import bhool jaana. Map dikhega par zoom
> buttons, popup, attribution sab toote hue lagenge — aur console mein koi
> error nahi aayega. Ghanta barbaad hota hai isme.

**Basemap** (bina API key ke, OSM raster tiles):

```js
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  },
  center: [92.7239, 23.7423],   // Aizawl — mock_slope_units.geojson ke bounds ka centre
  zoom: 13,
});
```

> **Do baatein:**
> 1. **Order `[longitude, latitude]` hota hai, `[lat, lng]` nahi.** Leaflet ulta
>    hai, MapLibre/GeoJSON aisa. Ulta likha toh map Somalia ke paas chala
>    jaayega — classic galti.
> 2. **Attribution hataana mana hai.** OSM ki tile usage policy hai; demo-level
>    traffic theek hai, par credit dikhna chahiye. Offline PWA (F8) ke liye
>    tiles cache karne ka alag plan Vishwajeet ke saath discuss karna.

**Centre hardcode karne ke bajaye data se nikaalna behtar hai** — mock GeoJSON
ke bounds par `map.fitBounds()` kar do, taaki asli slope units aane par map
apne aap sahi jagah aa jaaye.

### F3 — mock data se map (backend ka wait mat karo)

```js
import slopeUnits from '../../../data/sample/mock_slope_units.geojson';
// ya file ko frontend/src/lib/ mein copy kar lo — dono chalega

map.addSource('risk', { type: 'geojson', data: slopeUnits });
```

Live API baad mein — **sirf `data:` ki value badlegi, baaki poora code same.**

### Riya ke 3 hard rules (ye break nahi karne)

**1. Map ka rang `risk_level` se, `probability` se NAHI.**

```js
const COLOUR = { HIGH: '#dc2626', MEDIUM: '#f59e0b', LOW: '#16a34a' };
```

**Kyun:** §5 ka `AZ-1088` — probability 0.95 par risk LOW, kyunki neeche koi
nahi hai. Probability se colour karogi toh khaali pahaad red dikhega aur school
wala area green — **exactly ulta.**

**2. `population_label` ko as-is print karo.** Apna text mat likho.

```jsx
// ✅ sahi
<p>{f.properties.exposure_summary.population_label}</p>

// ❌ galat — ye wording rule tod rahi hai
<p>{f.properties.exposure_summary.population_estimate} people affected</p>
```

Backend already safe wording bhejta hai:
`"Estimated potentially exposed population: ~120"`.

**3. `meta.is_demo_data` true ho toh orange banner COMPULSORY.**

```jsx
{data.meta.is_demo_data && (
  <div className="bg-orange-500 text-white px-4 py-2 font-semibold">
    DEMO DATA — illustrative values, not an operational forecast
  </div>
)}
```

**Kyun:** ye ek boolean poori honesty policy ko **code mein** laata hai. Asli
data aane par backend `false` bhejega aur banner **khud gayab** ho jaayega —
tumhe kuch badalna nahi padega, aur koi galti se mock value ko real bolkar
present nahi kar sakta.

### `verification_status` → badge (default hamesha PENDING)

| Value | Badge |
|---|---|
| `PENDING_VERIFICATION` | grey outline — "Pending verification" |
| `CONFIRMED` | solid blue — "Confirmed by officer" |
| `FALSE_POSITIVE` | strikethrough grey |
| `NEEDS_REVIEW` | amber outline |

**UI ko `CONFIRMED` maan kar render karna allowed NAHI hai.**

### Snake line (F5) — demo ka best 20 second

X-axis = short-term cumulative rainfall, Y-axis = long-term wetness (soil ka
paani). Ek **critical curve** hai — line usko cross kare toh khatra.

- **Solid line** = jo ho chuka
- **Dashed line** = rainfall forecast ke hisaab se aage kya hoga
- **`trajectory[].crossed === true`** → red point

> **Dashed hissa hi "lead time" hai** — matlab kitne ghante pehle hum bata
> paaye. Yahi poore project ka sabse strong visual hai. **Kabhi cut nahi
> karna.**

### JSON validate karne ke liye (Python nahi chahiye)

```bash
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" data/sample/mock_risk_api_response.json && echo OK
```

### Riya ka Day 1 target

- [ ] F1 — Vite + React chal raha hai, Tailwind ka koi class kaam kar rahi hai
- [ ] F2 — MapLibre map Aizawl par centred, tiles dikh rahe hain
- [ ] Bonus: mock GeoJSON polygons map par dikh gaye

---

## 8. Git rules — aath line (poora `docs/GIT_WORKFLOW.md` mein hai)

1. **Apne folder mein raho.** Rudra → `ml/`, Riya → `frontend/`.
2. **`docs/`, `data/sample/`, `docker-compose.yml`, `README.md`, `environment.yml`
   sirf Vishwajeet edit karega.** Kuch chahiye toh bolo.
3. **Kaam shuru karne se pehle hamesha:**
   ```bash
   git checkout main && git pull origin main && git checkout -b r3-slope-units
   ```
4. **Seedha `main` par kabhi commit nahi.**
5. **Roz raat push karo** — kaam adhoora ho toh bhi. Push = backup.
6. **Commit message format:** `R3: slope units WhiteboxTools se generate kiye`
7. **`data/` (bade files) aur `.env` kabhi commit nahi.** DEM 100+ MB ka hota
   hai, GitHub reject karta hai. Aur **password ek baar push hua toh Git history
   mein HAMESHA reh jaata hai** — delete karne par bhi.
8. **Conflict aaye toh Vishwajeet ko bolo.** Akele solve karne ki koshish mein
   code kharab ho sakta hai. Phas gaye toh `git merge --abort` — sab pehle jaisa.

**Branch naming:** `<step-id>-<kaam>` → `r1-ml-env`, `r3-slope-units`,
`f1-react-setup`, `f2-maplibre-basemap`

---

## 9. Roz ka rhythm

**Subah 15 min standup** — teen sawaal:
1. Kal kya **khatam** hua
2. Aaj kya karoge
3. Kya **blocker** hai

**Raat 15 min** — screenshot dikhao, kya *actually* chal raha hai.

**Rule:** **30–60 min se zyada koi atka nahi rahega.** Bolo. Task todenge ya
mock data se aage badhenge. Chup-chaap atke rehna sabse bada nuksaan hai.

### Teen checkpoints

| | Kab | Kya chalna chahiye |
|---|---|---|
| **I1** | Day 1 raat | Map par **asli** Aizawl slope units (mock nahi) |
| **I2** | Day 2 raat | Rainfall → ML → API → Dashboard, end-to-end |
| **I3** | Day 3 | Final demo — verification + authorisation + alert |

Checkpoint par sab apni branch `main` mein merge karenge, phir sab pull
karenge. **Yahi asli integration test hai.**

---

## 10. Kuch badalna ho toh (contract change)

Field ka naam badalna hai? `probability` → `failure_probability`?

1. **WhatsApp par bolo** — akele mat badlo
2. Teeno haan bolein
3. **Vishwajeet** update karega: `API_CONTRACT.md` + mock file + route schema —
   **ek hi commit mein**
4. Commit: `CONTRACT: rename probability -> failure_probability`
5. Group mein bolo *"contract change, `git pull` karo"*

**Akela kabhi nahi badalna.** Ek banda badle toh baaki dono ka code chup-chaap
toot jaata hai — aur pata integration ke waqt chalta hai, jab time nahi hota.

---

## 11. Abhi kya ready hai, kya nahi (honest status)

| Cheez | Status |
|---|---|
| Repo + docs + mock data | ✅ ready |
| Backend `/health`, `/docs` endpoints | ✅ ready (V2 done) |
| Database (PostgreSQL + PostGIS) | ⬜ **V3 mein aayega — `docker-compose.yml` abhi nahi hai** |
| `/api/v1/slope-units` | ⬜ V6 |
| `/api/v1/risk/current` | ⬜ V9 |
| `frontend/package.json` | ⬜ **Riya banayegi (F1)** |
| `ml/` ka code | ⬜ **Rudra banayega (R1+)** |

> Isliye `README.md` ke `docker compose up -d` aur `cd frontend && npm install`
> **abhi kaam nahi karenge** — woh future state ke liye likhe hain. Upar §6/§7
> mein jo commands hain wahi aaj chalengi.

---

## 12. Ek line mein — kaun kya deta hai

| Kaun | Kya deta hai | Kya NAHI deta |
|---|---|---|
| **Rudra** | `probability` + band + drivers + tank state | `risk_level`, `verification_status` |
| **Vishwajeet** | `risk_level`, exposure, verification workflow, alert gate | model score |
| **Riya** | `risk_level` se coloured map, teen field alag-alag, demo banner | apne calculate kiye numbers |

**Ab shuru karo.** Rudra → §6 ki pehli command. Riya → §7 ki pehli command.
Atko toh 30 minute se zyada mat atko — bolo.
