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

**Endpoint:** `POST /api/v1/predictions/ingest`
**Auth:** internal service token (V10 mein)
**Reference file:** [`data/sample/mock_ml_output.json`](../data/sample/mock_ml_output.json)

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

| Case | Kyun |
|---|---|
| `probability` 0–1 ke bahar | Probability hai, percentage nahi |
| `confidence_lower > confidence_upper` | Band ulta hai |
| `slope_unit_id` DB mein nahi | Anaath prediction — kis slope ki hai? |
| `runout` hai par `source_citation` nahi | **Bina citation koi number system mein nahi ghusega** |
| `input_cutoff_ts` missing | Leakage prove nahi kar sakte |
| `risk_level` bheja gaya | ❌ **Rudra risk_level NAHI bhejta** — dekho §5 |

### Rudra ko exact message

> Bhai, tera output bilkul `data/sample/mock_ml_output.json` jaisa hona chahiye.
> `python -m json.tool` se validate karke bhej. Koi field naam badalna ho toh
> pehle batana — main API bhi badlunga aur ye doc bhi, ek hi commit mein.
> **`risk_level` tu nahi bhejega** — woh backend exposure ke saath milakar
> nikaalta hai.

---

## 4. Contract #2 — Vishwajeet → Riya

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

```python
def test_high_probability_zero_exposure_is_low_risk():
    """AZ-1088: 0.95 probability, zero exposure -> LOW.
    Risk is likelihood x consequence, never likelihood alone."""
    assert risk_level(0.95, Exposure(population_estimate=0,
                                     road_metres=0,
                                     critical_facilities=[])) == RiskLevel.LOW
```

Judge poochhega "aapka risk model score hi hai na?" — `AZ-1088` dikha dena.

---

## 6. Baaki endpoints (aage ke steps mein)

| Endpoint | Method | Step | Kaam |
|---|---|---|---|
| `/api/v1/slope-units` | GET | V6 | Slope unit polygons |
| `/api/v1/predictions/ingest` | POST | V7 | Rudra ka output leta hai |
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

**Rudra ke liye:** output bhejne se pehle hamesha ye chalao.
**Riya ke liye:** browser DevTools → Network tab → response dekh lo.

---

## 9. Ek line mein

| Kaun | Kya deta hai | Kya NAHI deta |
|---|---|---|
| **Rudra** | `probability` + band + drivers + tank state | `risk_level`, `verification_status` |
| **Vishwajeet** | `risk_level`, exposure, verification workflow, alert gate | model score |
| **Riya** | `risk_level` se coloured map, teen field alag-alag, demo banner | apne calculate kiye numbers |
