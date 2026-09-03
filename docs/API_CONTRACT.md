# API Contract — ML → Backend → Frontend

> **Ye file teeno ke beech ka legal agreement hai.**
> Rudra isko dekh kar output banayega, Vishwajeet isko dekh kar API banayega,
> Riya isko dekh kar UI banayegi. **Koi bhi field akela change nahi karega.**

---

## 1. Contract kya hai aur kyun zaruri hai

**Contract** = pehle se tay kar liya gaya JSON ka shape — kaun-kaun se keys
honge, unke andar kya type hoga.

**Bina contract ke kya hota:**

```
Rudra:      { "prob": 0.72 }
Vishwajeet: probability chahiye tha, prob mila -> KeyError -> crash
Riya:       risk_score dhoond rahi thi -> undefined -> blank screen
```

Teen log, teen naam, teen din barbaad. Ye hackathon mein **sabse common maut** hai.

**Contract ke saath:** teeno alag-alag jagah baithkar kaam karte hain, aur jab
jodte hain toh pehli baar mein chal jaata hai. Isko **"integration"** kehte hain,
aur ye mera (Vishwajeet ka) kaam hai.

---

## 2. Data kaise behta hai

```
       Rudra (ml/)                    Vishwajeet (backend/)              Riya (frontend/)
            |                                  |                                |
   three-tank + model                          |                                |
            |                                  |                                |
     mock_ml_output.json  --- POST --->  /api/v1/predictions/ingest             |
                                                |                                |
                                         probability DB mein save                |
                                                |                                |
                                         runout + exposure  (PostGIS)            |
                                                |                                |
                                         risk_level = f(prob, exposure)          |
                                                |                                |
                                                +--- GET /api/v1/risk/current -->|
                                                |                          MapLibre + cards
                                                |                                |
                                         verification (human)                    |
                                                |                                |
                                         alert authorisation (human)             |
                                                |                                |
                                         CAP XML -> SMS gateway                  |
```

**Mock-first rule:** har banda `data/sample/` ki file se shuru karega, live URL
baad mein lagega. Shape same hai, isliye **code badalna nahi padega** — sirf URL.

---

## 3. Contract #1 — Rudra → Vishwajeet

### Ye endpoint AB LIVE hai (V7)

**Endpoint:** `POST /api/v1/predictions/ingest`
**Auth:** internal service token (V10 mein) — abhi khula hai
**Reference file:** [`data/sample/mock_ml_output.json`](../data/sample/mock_ml_output.json)

Rudra ye file jaisi hi body bhejega. Wahi file abhi seedha post ki ja sakti
hai aur **201** deti hai:

```bash
curl -s -X POST http://localhost:8000/api/v1/predictions/ingest \
  -H 'content-type: application/json' \
  --data-binary @data/sample/mock_ml_output.json
```

Jawab:

```json
{
  "forecast_run_id": 2,
  "model_version": "tank-stageA-v0.1",
  "predictions_stored": 3,
  "runouts_stored": 3,
  "exposures_stored": 3,
  "risk_level": null,
  "verification_status": "PENDING_VERIFICATION",
  "is_demo_data": true,
  "mock_slope_units": 3,
  "warnings": [
    "predictions[0].runout.source_citation reads like a placeholder ...",
    "predictions[0].exposure.population_source is mock data and must not be quoted as a measurement ..."
  ]
}
```

`risk_level: null` **jaan-boojh kar** bheja jaata hai, hataya nahi jaata.
Missing key ko koi "risk nikal gaya aur theek tha" padh sakta hai; `null`
ka matlab saaf hai — abhi nikala hi nahi (V8 nikaalega).

### Top level

| Field | Type | Required | Matlab |
|---|---|---|---|
| `forecast_run` | object | ✅ | Ye run kab chala, kaunsa model |
| `predictions` | array | ✅ | Har slope unit ke liye ek entry |

### `forecast_run`

| Field | Type | Required | Matlab |
|---|---|---|---|
| `run_ts` | ISO 8601 + offset | ✅ | Model kab chala |
| `input_cutoff_ts` | ISO 8601 + offset | ✅ | **Is instant ke baad ka koi data use nahi hua** |
| `model_version` | string | ✅ | e.g. `tank-stageA-v0.1` |
| `is_hindcast` | bool | ✅ | Purani date par chalaya (testing) ya live |

> **`input_cutoff_ts` kyun sabse important field hai:**
> Hindcast mein ye **saabit karta hai ki model ne future nahi dekha.**
> Agar 3 September ki landslide predict karne ke liye 4 September ka rainfall
> use ho gaya, toh accuracy 99% aayegi aur **poori tarah jhoothi** hogi.
> Isko **temporal leakage** kehte hain, aur ye ML papers mein reject hone ka
> #1 kaaran hai. Backend is field ko DB mein save karta hai, aur koi bhi
> feature iske baad ka nahi hona chahiye.

### `predictions[]`

| Field | Type | Required | Matlab / Rule |
|---|---|---|---|
| `slope_unit_id` | string | ✅ | `slope_unit` table mein maujood hona chahiye, warna 422 |
| `valid_from`, `valid_to` | ISO 8601 | ✅ | Forecast window |
| `susceptibility_score` | float 0–1 | ✅ | Static — slope kitna khatarnaak hai (saal mein badalta hai) |
| `probability` | float 0–1 | ✅ | Is window mein fail hone ka chance (ghante mein badalta hai) |
| `confidence_lower/upper` | float 0–1 | ✅ | Uncertainty band. **Bare number kabhi nahi bhejna** |
| `tank_state` | object | ✅ | `s1_mm`, `s2_mm`, `s3_mm`, `swi_mm` |
| `rainfall` | object | ✅ | `observed_24h_mm`, `forecast_24h_mm`, `fraction_of_map` |
| `drivers` | object | ✅ | SHAP values — feature ka naam → contribution |
| `counterfactual` | string | ✅ | "40 mm kam antecedent rainfall hota toh ye fire nahi hota" |
| `data_quality` | object | ✅ | `nearest_gauge_km`, `rainfall_confidence` |
| `runout` | object | ⬜ | Ho toh `source_citation` **compulsory** |
| `exposure` | object | ⬜ | Rudra bheje ya backend khud PostGIS se nikaale |

### Backend jo REJECT karega (422)

Ye poori list hai, aur har ek par ek test khada hai
([`backend/test/predictions.test.js`](../backend/test/predictions.test.js)):

| Case | Kyun |
|---|---|
| `probability` 0–1 ke bahar | Probability hai, percentage nahi |
| `confidence_lower > confidence_upper` | Band ulta hai |
| `probability` apne hi band ke bahar | Ulta band se bhi bura — imaandaar uncertainty jaisa dikhta hai par arithmetic mein impossible hai |
| `valid_to` ≤ `valid_from` | Window ulti ya zero-length |
| `input_cutoff_ts` missing | Leakage prove nahi kar sakte |
| `input_cutoff_ts` > `run_ts` | **Temporal leakage** — model ne apne chalne ke baad ka data use kiya |
| Timestamp mein UTC offset nahi | `2026-09-03T10:00:00` ambiguous hai. IST +05:30 hai, toh isko UTC padhna cutoff ko 5.5 ghante **aage** khiskata hai — theek wahi direction jo future rainfall andar aane deta hai |
| `slope_unit_id` DB mein nahi | Anaath prediction — kis slope ki hai? Message mein id likhi hoti hai |
| Ek run mein ek slope unit do baar | Ek run = ek prediction per slope unit |
| `predictions: []` khaali | Khaali run se `forecast_run` row banane ka koi matlab nahi |
| `runout` hai par `source_citation` nahi | **Bina citation koi number system mein nahi ghusega** |
| `runout.envelope_geojson` invalid polygon | Neeche dekho — ye chup-chaap LOW risk banata hai |
| `drivers` ki koi value number nahi | SHAP contribution frontend par bar chart hai; string "high" bar ki height nahi ban sakti |
| `population_estimate > 0` par `population_source` nahi | Population figure apni assumption ke bina andar nahi aata. **Zero exempt hai** — "koi exposed nahi" finding hai, estimate nahi (AZ-1088 ka case) |
| `risk_level` bheja gaya | ❌ **Rudra risk_level NAHI bhejta** — dekho §5 |
| `verification_status` bheja gaya | Woh naam-wale officer ka kaam hai (V11) |
| `is_demo_data` bheja gaya | Backend derive karta hai, koi assert nahi kar sakta |

### 422 ka body kaisa dikhta hai

Fastify default 400 deta hai aur sirf ek line message. Yahan **422** hai aur
`details` array mein **har** galti ka naam:

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "The request body was understood but is not acceptable: 2 problem(s). Nothing was written.",
  "details": [
    "predictions[0].probability: must be <= 1",
    "predictions[1].confidence_upper: must be >= 0"
  ]
}
```

Do baatein isme jaan-boojh kar hain:

- **Saari galtiyaan ek saath.** AJV default mein pehli par ruk jaata hai. 12
  prediction mein 3 galat hon toh ek-ek theek karke teen round-trip lagte.
- **Field ka naam `predictions[0].probability` shakal mein.** AJV `instancePath`
  `/predictions/0/probability` deta hai; JSON usi shakal mein likha jaata hai
  jismein Rudra ne likha hai, toh usi shakal mein wapas jaata hai.

400 aur 422 ka farq: **400 = "main request samajh hi nahi paaya"** (toota
JSON, galat URL). **422 = "samajh gaya, accept nahi kar sakta"**. Querystring
aur path ki galtiyaan 400 par hi rehti hain.

### Kuch bhi galat = kuch bhi save nahi

Poora ingest **ek transaction** hai. 12 prediction mein sirf 12th galat ho
toh pehle 11 bhi save nahi hote, `forecast_run` row bhi nahi banti. Aadha
ingest hua run map par "adhoora forecast" nahi, "chala hua forecast" jaisa
dikhta — aur aage koi step ye farq nahi bata sakta.

### `runout` polygon invalid ho toh 422 — ye sabse chupa hua khatra tha

V7 mein ye galti se mila. Postgres ka `GEOMETRY(POLYGON, 4326)` sirf **type**
aur **SRID** check karta hai, **validity nahi**. Teen position wali unclosed
ring accept ho gayi thi aur endpoint ne 201 diya tha.

Ye untidy nahi, khatarnaak hai: runout envelope hi exposure intersection ka
input hai. Invalid polygon par `ST_Intersection` error nahi deta — **khaali**
geometry deta hai. Toh slope ke neeche ke ghar aur road zero aa jaate, aur
risk step zero exposure padhkar **LOW** bol deta — populated hillside par,
log mein ek bhi error ke bina.

Ab do jagah band hai: `008_geometry_validity.sql` mein CHECK constraint (har
writer par lagu, sirf is route par nahi), aur route pehle PostGIS se poochta
hai taaki jawab 500 ki jagah 422 ho jo asli coordinate batata ho:

```json
"details": ["predictions[0].runout.envelope_geojson: Self-intersection[92.7425 23.748]"]
```

Ring band karna yaad rakhna — pehli position aakhir mein dobara. Loop mein
polygon banate waqt yahi bhoolna sabse common hai, aur uska message hai
"a polygon ring needs at least 4 positions and this has 3".

### `warnings` — 201 ke saath aane wali baatein

Kuch cheezein galat nahi par shak-wali hain. Unpar ingest rokna galat hota
(shipped mock file khud demo mein post hoti hai), toh **201 milta hai aur
`warnings` array mein naam aata hai**:

- `source_citation` mein `PLACEHOLDER`, `TODO`, `TBD` jaisa kuch
- `runout` hai par `angle_of_reach_deg` nahi
- `population_source` mock hai — measurement ki tarah quote nahi karna
- `is_estimate: false` bheja gaya population figure par

Rudra: warnings khaali karna target hai, par R5 tak inke saath kaam chalega.

### `_comment` keys hata di jaati hain

Mock file khud ko `_comment` se document karti hai — `drivers` ke andar,
`rainfall` ke andar, `road_segments[0]` ke andar. Ye JSONB column mein jaate
hain, toh recursively strip hoti hain. Warna `drivers._comment` frontend par
ek SHAP feature ban jaata jiska contribution ek poora vaakya hai.

Matlab: `_` se shuru hone wala koi bhi key **save nahi hoti**. Comment likhna
ho toh theek hai, par usme kaam ka data mat rakhna.

### `exposure` par do cheezein backend khud kar leta hai

- `road_metres` na bheja ho toh `road_segments[].metres` ka jod le liya jaata
  hai. NULL rehne dena UI par "0 m road" likhwaata — us road ke naam ke bagal
  mein jo wahin listed hai.
- `is_estimate` hamesha `true` set hota hai, bheja hua maana nahi jaata. Yahan
  har figure model ke runout envelope se aata hai, survey se nahi.

### Rudra ko exact message

> Bhai, tera output bilkul `data/sample/mock_ml_output.json` jaisa hona chahiye.
> `python -m json.tool` se validate karke bhej. Koi field naam badalna ho toh
> pehle batana — main API bhi badlunga aur ye doc bhi, ek hi commit mein.
> **`risk_level` tu nahi bhejega** — woh backend exposure ke saath milakar
> nikaalta hai.
>
> Endpoint live hai. Body galat hui toh **422** milega aur `details` array mein
> exactly kaunsa field galat hai woh likha hoga — server log dekhne ki zarurat
> nahi. Do cheezein khaas: har timestamp mein **UTC offset** lagana
> (`+05:30`), aur runout ring **band** karna (pehli position aakhir mein
> dobara), warna polygon invalid hai.

---

## 4. Contract #2 — Vishwajeet → Riya

### 4a. Ye endpoint AB LIVE hai — `GET /api/v1/slope-units` (V6)

`risk/current` (V9) abhi baaki hai, par **slope units ab asli database se aa
rahe hain.** Riya isko aaj map par draw kar sakti hai — mock file ki zarurat
nahi.

```js
const res = await fetch('http://localhost:8000/api/v1/slope-units?district=aizawl');
map.addSource('slope-units', { type: 'geojson', data: await res.json() });
```

`district` optional hai; default pilot district (`aizawl`) hai.

**Response** ek GeoJSON `FeatureCollection` hai jisme ek extra `meta` block hai:

```json
{
  "type": "FeatureCollection",
  "meta": {
    "district_id": "aizawl",
    "count": 5,
    "mock_count": 5,
    "is_demo_data": true,
    "crs": "EPSG:4326",
    "disclaimer": "5 of 5 slope unit(s) are illustrative geometry, not derived from a DEM. Do not quote their areas or locations as measurements."
  },
  "features": [
    {
      "type": "Feature",
      "id": "AZ-1088",
      "geometry": { "type": "Polygon", "coordinates": [[[92.7412, 23.7508], "..."]] },
      "properties": {
        "slope_unit_id": "AZ-1088",
        "district_id": "aizawl",
        "ward_name": "Bawngkawn",
        "area_ha": 9.25,
        "centroid": [92.742094, 23.749368],
        "mean_slope_deg": 41.6,
        "susceptibility_score": 0.91,
        "source": "MOCK -- hand-drawn polygons over the Aizawl area, not derived from a DEM (data/sample/mock_slope_units.geojson)",
        "is_mock": true
      }
    }
  ]
}
```

Baaki properties (`max_slope_deg`, `aspect_sin`, `aspect_cos`, `relief_m`,
`profile_curvature`, `twi`, `lithology_class`, `landcover_class`,
`geological_province`, `dist_to_road_m`, `has_road_cut`,
`mean_annual_precip_mm`, `seismic_weakening`) bhi hain — 22 total. Ye Rudra ke
model ke input feature hain, Riya ko sirf `ward_name`, `area_ha`,
`susceptibility_score` aur `source`/`is_mock` chahiye honge.

**Chaar cheezein jo dhyan rakhni hain:**

| Cheez | Kya |
|---|---|
| `properties.slope_unit_id` | Feature ka `id` bhi wahi hai. `properties.id` **nahi** hai |
| `is_mock` + `source` | **Har feature mein alag**, envelope mein nahi — response real aur mock mix kar sakta hai |
| `meta.is_demo_data` | `DEMO_MODE` flag **YA** koi bhi mock row. Mock rows loaded hon toh `DEMO_MODE=false` isko band **nahi** kar sakta |
| `area_ha` | Polygon se **naapa** gaya hai (`ST_Area`), file se copy nahi. 2 decimal = 100 m² |

Single unit ke liye (click-a-polygon panel):

```
GET /api/v1/slope-units/AZ-1088   ->  ek bare Feature (FeatureCollection nahi)
```

Status codes:

| Code | Kab |
|---|---|
| `200` | Mila |
| `400` | `district` ya `id` identifier jaisa nahi (`^[a-z0-9_-]{2,40}$`) |
| `404` | District exist nahi karta, ya slope unit id exist nahi karta — **khaali collection nahi** |
| `503` | `DATABASE_URL` set nahi hai. `/health` bhi `not_configured` bolega |

> **404 vs khaali collection:** `?district=aizwal` (typo) par khaali
> `FeatureCollection` bhejna Riya ko khaali map dikhata aur wajah kabhi pata na
> chalti. 404 saaf bolta hai "aisa district nahi hai".

Coordinates 6 decimal par cap hain (~11 cm) — DEM-derived boundary se kaafi
zyada barik. Axis order RFC 7946 wala hai: **`[longitude, latitude]`**, `[lat,
lon]` nahi.

### 4b. Poora dashboard feed (V9, abhi mock)

**Endpoint:** `GET /api/v1/risk/current?district=aizawl`
**Response:** GeoJSON `FeatureCollection` + extra top-level blocks
**Reference file:** [`data/sample/mock_risk_api_response.json`](../data/sample/mock_risk_api_response.json)

### Kyun GeoJSON

MapLibre GeoJSON **seedha** kha leta hai. Custom format hota toh Riya ko
converter likhna padta — 2 ghante barbaad, bug ka mauka.

```js
map.addSource('risk', { type: 'geojson', data: riskResponse });
```

Bas. Extra keys (`meta`, `summary`, `snake_line`) MapLibre ignore kar deta hai,
Riya unko cards aur chart ke liye use karti hai.

### Top level

| Field | Type | Riya kahan use karegi |
|---|---|---|
| `meta` | object | Header — timestamp, model version, **DEMO banner** |
| `summary` | object | Top ke KPI tiles |
| `type` + `features` | GeoJSON | Map layer |
| `snake_line` | object | Recharts chart |

### `meta.is_demo_data` — sabse important boolean

```jsx
{data.meta.is_demo_data && (
  <div className="bg-orange-500 text-white px-4 py-2 font-semibold">
    DEMO DATA — illustrative values, not an operational forecast
  </div>
)}
```

> **Kyun:** ye ek flag poori honesty policy ko **code mein** laata hai,
> sirf documentation mein nahi. Demo mein banner dikhega. Asli data aayega toh
> backend `false` bhejega aur banner **khud** gayab ho jaayega. Riya ko kuch
> badalna nahi padega, aur koi galti se mock value ko real bolkar present nahi
> kar sakta.

### `features[].properties` — teen alag field

| Field | Kaun set karta hai | UI mein kahan |
|---|---|---|
| `probability` + band | **model** | Card mein number: `0.72 (0.58–0.84)` |
| `risk_level` | **probability × exposure** | **Map ka rang** |
| `verification_status` | **insaan (officer)** | Alag badge |

> **Map ka rang `risk_level` se aayega, `probability` se NAHI.**
> Ye is poore project ka sabse zaruri UI rule hai.

Baaki fields:

| Field | Type | UI |
|---|---|---|
| `slope_unit_id` | string | Card title |
| `ward_name` | string | Card subtitle |
| `exposure_summary` | object | "17 buildings · 340 m road · 1 school" |
| `exposure_summary.population_label` | string | **Isko as-is print karna** — wording pehle se safe hai |
| `why` | string[] | Bullet list — "WHY" section |
| `counterfactual` | string | Italic line |
| `data_quality.label` | string | Chhoti grey line |
| `has_field_report` | bool | Camera icon 📷 |
| `runout_envelope` | Polygon \| null | Dashed outline layer. `null` ho toh layer skip |
| `geometry` | Polygon | Slope unit ka filled polygon |

### `risk_level` → rang

| Value | Rang | Hex |
|---|---|---|
| `HIGH` | red | `#dc2626` |
| `MEDIUM` | amber | `#f59e0b` |
| `LOW` | green | `#16a34a` |

### `verification_status` → badge

| Value | Badge |
|---|---|
| `PENDING_VERIFICATION` | grey outline, "Pending verification" |
| `CONFIRMED` | solid blue, "Confirmed by officer" |
| `FALSE_POSITIVE` | strikethrough grey |
| `NEEDS_REVIEW` | amber outline |

**Default hamesha `PENDING_VERIFICATION` hai.** UI ko `CONFIRMED` maan kar
render karna **allowed nahi** hai.

### `snake_line`

| Field | Chart mein |
|---|---|
| `critical_curve` | Solid black line — threshold |
| `trajectory` | Points + connecting line |
| `trajectory[].is_forecast` | `true` → **dashed** |
| `trajectory[].crossed` | `true` → red point |
| `x_label`, `y_label` | Axis labels |

> **Dashed hissa hi lead time hai.** Solid = jo ho chuka. Dashed = jahan
> rainfall forecast keh raha hai slope jaa rahi hai. Ye demo ke sabse achhe
> 20 second hain — **kabhi cut nahi karna.**

### Riya ko exact message

> Riya, `data/sample/mock_risk_api_response.json` ko `src/lib/mockRisk.json`
> mein import karke poora dashboard bana lo. Live API baad mein aayega,
> **shape exactly same rahega** — sirf import ki jagah `fetch` aayega, aur kuch
> nahi badlega.
>
> Teen rule:
> 1. **Map ka rang `risk_level` se, `probability` se nahi**
> 2. `population_label` ko as-is print karna — apna text nahi likhna
> 3. `meta.is_demo_data` true ho toh orange banner **compulsory**

---

## 5. Sabse important cheez — `risk_level` Rudra nahi bhejta

`risk_level` **backend** calculate karta hai. Rudra sirf `probability` bhejta hai.

Ye V7 se **code mein enforce** hai, sirf likha hua rule nahi: ingest endpoint
`risk_level` wale prediction ko 422 karta hai, aur `prediction` row `risk_level`
NULL ke saath banti hai. V8 usko bharega.

> **Chup-chaap drop kyun nahi karte:** Fastify ka AJV `removeAdditional: true`
> par chalta hai, toh `additionalProperties: false` unknown field ko **strip**
> karta hai, reject nahi. Rudra `risk_level` bhejta, backend chup-chaap phenk
> deta, aur woh samajhta ki maan liya gaya. Isliye schema mein wo option
> jaan-boojh kar nahi hai aur handler in field ko **naam lekar** refuse karta
> hai.

**Kyun:**

Risk = **likelihood × consequence**. Model sirf likelihood jaanta hai. Consequence
(kitne ghar, kitne log, kaunsi sadak) PostGIS ke exposure intersection se aata hai,
jo backend mein hai.

**File ke andar hi iska proof hai — `AZ-1088`:**

| Field | Value |
|---|---|
| `probability` | **0.95** — sabse zyada |
| `buildings_count` | 0 |
| `population_estimate` | 0 |
| `risk_level` | **LOW** ✅ |

Slope girne wali hai, par neeche **koi nahi hai**. Isliye risk LOW.

Agar `risk_level = probability` hota, toh ye unit RED dikhta, officer wahan team
bhejta, aur us waqt **AZ-1142** — jahan 120 log aur ek school hai — ignore ho
jaata. **Yahi resource misallocation logon ki jaan leta hai.**

Ye V8 ka unit test hai:

```js
test('AZ-1088: probability 0.95, exposure zero -> LOW', () => {
  // Risk = likelihood x consequence. Sirf likelihood se kabhi nahi.
  assert.equal(
    riskLevel(0.95, { populationEstimate: 0, roadMetres: 0, criticalFacilities: [] }),
    'LOW',
  );
});
```

Judge poochhega "aapka risk model score hi hai na?" — `AZ-1088` dikha dena.

---

## 6. Baaki endpoints (aage ke steps mein)

| Endpoint | Method | Step | Kaam |
|---|---|---|---|
| `/api/v1/slope-units` | GET | V6 | Slope unit polygons — **LIVE, section 4a dekho** |
| `/api/v1/slope-units/{id}` | GET | V6 | Ek slope unit — **LIVE** |
| `/api/v1/predictions/ingest` | POST | V7 | Rudra ka output leta hai — **LIVE, section 3 dekho** |
| `/api/v1/risk/current` | GET | V9 | Riya ka main dashboard feed |
| `/api/v1/predictions/{id}/verify` | POST | V11 | Officer confirm/reject kare |
| `/api/v1/field-reports` | POST | V12 | Citizen geo-tagged photo |
| `/api/v1/field-reports` | GET | V12 | Review queue |
| `/api/v1/alerts/draft` | POST | V13 | Alert draft banao (dispatch NAHI) |
| `/api/v1/alerts/{id}/authorise` | POST | V13 | **Named human** dispatch kare |
| `/api/v1/alerts/{id}/cap.xml` | GET | V13 | CAP 1.2 XML |
| `/api/v1/audit-log` | GET | V14 | Append-only log |

`draft` aur `authorise` **jaan-boojh kar alag** hain. Ek hi endpoint hota toh
AI khud alert bhej sakta tha. DB `CHECK` constraint bhi isko rokta hai:

```sql
CONSTRAINT must_be_authorised_before_dispatch
  CHECK (status <> 'DISPATCHED' OR authorised_by IS NOT NULL)
```

**Ye constraint isliye hai ki agar main code mein bug kar dun, toh database
khud dispatch reject kar de.** Rule documentation mein nahi, **schema mein**
likha hai.

---

## 7. Field naam badalna ho toh

1. WhatsApp par batao — "`probability` ko `failure_probability` karna hai"
2. Teeno haan bolein
3. **Vishwajeet** update kare: ye doc + mock file + route ka JSON schema — **ek commit mein**
4. Commit message: `CONTRACT: rename probability -> failure_probability`
5. Group mein bolo "contract change, `git pull` karo"

**Akela kabhi nahi badalna.** Ek banda badle toh baaki dono ka code chup-chaap
toot jaata hai, aur pata integration ke waqt chalta hai — jab time nahi hota.

---

## 8. Validate karne ka tareeka

```bash
python -m json.tool data/sample/mock_ml_output.json > /dev/null && echo OK
```

`OK` aaya = valid JSON. Error aaya = comma ya bracket galat.

Jiske paas Python nahi hai (Riya), woh Node se wahi kaam karega:

```bash
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" data/sample/mock_risk_api_response.json && echo OK
```

**Rudra ke liye:** output bhejne se pehle hamesha ye chalao.
**Riya ke liye:** browser DevTools → Network tab → response dekh lo.

---

## 9. Ek line mein

| Kaun | Kya deta hai | Kya NAHI deta |
|---|---|---|
| **Rudra** | `probability` + band + drivers + tank state | `risk_level`, `verification_status` |
| **Vishwajeet** | `risk_level`, exposure, verification workflow, alert gate | model score |
| **Riya** | `risk_level` se coloured map, teen field alag-alag, demo banner | apne calculate kiye numbers |
