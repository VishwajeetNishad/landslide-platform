# Riya ke liye — backend ab chal raha hai, kaise connect karna hai

Ye doc `docs/API_CONTRACT.md` ko **replace nahi** karta. Contract batata hai
*shape kya hai*; ye batata hai *aaj isko chalu karke apne map par kaise laana
hai*. Contract hi source of truth hai — field ka naam kabhi doubt ho toh
wahin dekhna.

Aakhri update: 4 September 2026, V9 merge ke baad.

---

## 1. Abhi kya LIVE hai aur kya nahi

| Endpoint | Kaam | Status |
|---|---|---|
| `GET /api/v1/slope-units?district=aizawl` | 5 slope unit polygons, GeoJSON | ✅ **LIVE** |
| `GET /api/v1/slope-units/{id}` | Ek slope unit | ✅ **LIVE** |
| `GET /health` | Backend + DB theek hai ya nahi | ✅ **LIVE** |
| `GET /docs` | Swagger UI — browser mein API khud test karo | ✅ **LIVE** |
| `POST /api/v1/predictions/ingest` | Rudra ka output andar aata hai | ✅ LIVE (tumhara kaam nahi) |
| `GET /api/v1/risk/current` | **Tumhara main dashboard feed** | ✅ **LIVE** |

Matlab **map aur risk dashboard ab asli database se ban sakta hai.** `fetch` ko
`http://localhost:3000/api/v1/risk/current?district=aizawl` par point karo —
shape exactly `data/sample/mock_risk_api_response.json` jaisa hai.

---

## 2. Backend chalu karna — teen command

Repo root se:

```bash
docker compose up -d
```

```bash
cd backend && npm install && npm run migrate && npm run load:slope-units
```

```bash
npm run dev
```

Ab `http://localhost:8000/docs` browser mein khol lo. Wahan se hi endpoint
try kar sakti ho — mujhse poochhne ki zarurat nahi.

Check karne ke liye:

```bash
curl -s http://localhost:8000/health
```

`"status": "ok"` aana chahiye. `not_configured` aaye toh `.env` mein
`DATABASE_URL` nahi hai — mujhe bolo, main bhej dunga (**`.env` git mein
kabhi nahi jaata**).

---

## 3. Map par polygon laane wala code

CORS pehle din se laga hua hai, toh `localhost:5173` se seedha fetch chalega.
Kuch setup nahi chahiye.

```jsx
// src/lib/api.js
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function fetchSlopeUnits(district = 'aizawl') {
  const res = await fetch(`${API}/api/v1/slope-units?district=${district}`);
  if (!res.ok) throw new Error((await res.json()).message);
  return res.json();   // ye seedha GeoJSON FeatureCollection hai
}
```

MapLibre mein:

```jsx
const data = await fetchSlopeUnits();

map.addSource('slope-units', { type: 'geojson', data });   // parse karne ki zarurat nahi
map.addLayer({
  id: 'slope-fill',
  type: 'fill',
  source: 'slope-units',
  paint: { 'fill-color': '#888', 'fill-opacity': 0.4 },   // rang V9 mein risk_level se aayega
});
```

Base URL ko `.env.local` mein rakhna (`VITE_API_URL=http://localhost:8000`),
code mein hardcode nahi — demo waale din port badalna pada toh ek jagah
badlega.

---

## 4. Response kaisa dikhta hai (ye asli output hai, banaya hua nahi)

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
      "id": "AZ-0964",
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [[[92.706, 23.762], "..."]] },
      "properties": {
        "slope_unit_id": "AZ-0964",
        "ward_name": "Durtlang",
        "area_ha": 58.12,
        "mean_slope_deg": 21.8,
        "susceptibility_score": 0.23,
        "is_mock": true,
        "source": "MOCK -- hand-drawn polygons over the Aizawl area, not derived from a DEM (...)"
      }
    }
  ]
}
```

`properties` mein **22 field** hain (twi, relief_m, lithology_class,
aspect_sin/aspect_cos, waghera). Ye pop-up mein dikhane ke liye hain — poori
list `API_CONTRACT.md` §4a mein hai.

Aur `risk/current` ka `summary` aisa aata hai (ye bhi asli output hai):

```json
{
  "total_slope_units": 3,
  "high_risk_count": 2,
  "medium_risk_count": 0,
  "low_risk_count": 1,
  "risk_not_computed_count": 0,
  "pending_verification_count": 3,
  "lead_time_hours": 10
}
```

Dhyaan do: **paanch** count hain, chaar nahi. `risk_not_computed_count`
neeche §5 mein samjhaya hai — usko `low_risk_count` mein mat jodna.

---

## 5. Chhe cheezein jo galat karna aasaan hai

**`properties.slope_unit_id` use karna, `properties.id` nahi.** Feature ke
paas apna `id` member already hai (`feature.id`). `properties.id` likhne se
lagta hai "is properties object ki id", jo galat matlab hai.

**Coordinates `[longitude, latitude]` hain, `[lat, lon]` nahi.** GeoJSON ka
standard (RFC 7946) yahi hai, chahe har insaan "lat, lon" bolta ho. Ulta
kiya toh polygon **Somalia ke paas** chala jaayega — crash nahi hoga, bas
galat jagah draw hoga. Aizawl ke liye longitude ~92.7, latitude ~23.75.

**`meta.is_demo_data` true ho toh orange banner COMPULSORY.** Ye
negotiable nahi hai. Aur dhyaan rakhna: `DEMO_MODE=false` karke isko band
**nahi** kar sakte — jab tak mock polygon load hain, backend `true` hi
bhejega. Jaan-boojh kar aisa hai.

**`susceptibility_score` risk NAHI hai.** Woh static hai — "ye slope
kitna khatarnaak hai", saal mein badalta hai. Map ka rang `risk_level` se
aayega jo V9 mein milega. Iss field se rang mat banana, warna jo baat hum
demo mein prove kar rahe hain wahi tut jaayegi (§5 of API_CONTRACT dekho —
AZ-1088).

**`area_ha` napa hua hai, file se copy nahi.** Backend PostGIS se
calculate karta hai, toh ye number bharosemand hai — par `is_mock: true`
wale unit ki geometry hand-drawn hai, toh area ko "measurement" bolkar
quote nahi karna.

**`risk_level` `null` ho toh use GREEN mat karna.** `risk/current` mein
`properties.risk_level` chaar values de sakta hai: `HIGH`, `MEDIUM`, `LOW`,
ya `null`. `null` ka matlab **"low risk" nahi** hai — matlab hai *us slope
ka exposure nikala hi nahi gaya*, toh risk ka jawab hi nahi hai. Usko
**grey / hatched** karo aur legend mein "Not assessed" likho.

Kyun ye itna matter karta hai: AZ-1088 ka `LOW` ek **finding** hai — runout
envelope draw hua, intersect hua, neeche koi nahi nikla. `null` ek
**absence** hai. Dono ko green karne ka matlab hai officer ko dikhana ki
"yahan koi khatra nahi" jab humne dekha hi nahi. `summary` mein iske liye
`risk_not_computed_count` alag field hai — usko summary card par dikhana,
`low_risk_count` mein add nahi karna.

---

## 6. Error kaise handle karna

Sab error ek hi shakal mein aate hain:

```json
{ "statusCode": 404, "error": "Not Found", "message": "..." }
```

| Code | Kab | Tum kya karo |
|---|---|---|
| `400` | `district` ya `id` identifier jaisa nahi | Apna input theek karo |
| `404` | District ya slope unit exist nahi karta | "Aisa district nahi hai" dikhao |
| `503` | Backend chalu hai par DB nahi | **"Data unavailable" dikhao — khaali map nahi.** Khaali map jhooth bolta hai: "koi risk nahi hai" |
| `422` | Body ka matlab galat hai (ingest par) | Tumhare endpoints par nahi aayega |

`404` aur khaali collection ka farq: `?district=aizwal` (typo) par backend
khaali list **nahi** bhejta, `404` bhejta hai. Warna typo "is district mein
koi slope nahi hai" jaisa dikhta.

---

## 7. F1/F2 ke liye kya karna hai

1. Vite + React setup (**Next.js nahi**), MapLibre install
2. Aizawl par blank map — center `[92.72, 23.73]`, zoom ~12
3. Upar ka fetch laga kar paanch polygon draw karo
4. `is_demo_data` ka orange banner
5. Polygon click par pop-up: ward_name, area_ha, mean_slope_deg

Ye **checkpoint I1** hai — pehli cheez jo asli API se map par aayegi.
Ho jaaye toh screenshot bhej do, main verify kar lunga.

Field ka naam badalna ho ya kuch aur chahiye — pehle bolna. Main API aur
`API_CONTRACT.md` dono ek hi commit mein badlunga, taaki doc aur code kabhi
alag na hon.
