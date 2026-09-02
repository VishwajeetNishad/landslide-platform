# Data folder

## ⚠️ Yahan bade data files GitHub par NAHI jaate

`.gitignore` `data/` ko block karta hai, **sirf `data/sample/` chhod kar**.

**Kyun:**
- Ek Copernicus DEM tile 100+ MB ka hota hai
- **GitHub 100 MB se badi file reject karta hai**
- Galti se push ho gaya toh Git history se hataana bahut painful hai
- Har banda apna data khud download karega (script se), repo se nahi laayega

---

## `sample/` mein kya hai — mock data

Ye **nakli data** hai jo shakal mein asli jaisa hai. **Iska maqsad:** teeno team
members ek doosre ka wait na karein.

| File | Kaun use karega | Kis cheez ki jagah |
|---|---|---|
| `mock_slope_units.geojson` | **Riya** — map par polygons dikhane ke liye | Rudra ka `R3` output |
| `mock_ml_output.json` | **Vishwajeet** — ingest API test karne ke liye | Rudra ka `R8` output |
| `mock_risk_api_response.json` | **Riya** — dashboard banane ke liye | Vishwajeet ka `V9` API |

**Bina mock data ke kya hota:** Riya `V6` ka wait karti, Vishwajeet `R8` ka wait
karta. Sab ek doosre par atke rehte. Mock ke saath **teeno parallel chalte hain.**

> ⚠️ **Ye saare values illustrative hain — asli predictions NAHI hain.**
> Demo ya presentation mein inko real forecast bolkar kabhi present nahi karna.
> Coordinates asli Aizawl area ke hain (taaki map theek dikhe), par polygons
> hand-drawn hain, DEM se nikale hue nahi.

---

## Asli data sources (jab download karenge)

Sab free hain. Kisi agency ki permission ki zarurat nahi.

| Data | Source | Resolution | Kis kaam ka |
|---|---|---|---|
| **DEM** | Copernicus DEM GLO-30 | 30 m | slope, aspect, slope units, runout |
| **Rainfall (observed)** | NASA GPM IMERG | 0.1°, 30 min | antecedent rainfall, tank forcing |
| **Rainfall (forecast)** | ECMWF Open Data | 0.25°, 6-hourly | **lead time yahan se aata hai** |
| **Rainfall (official)** | IMD | station/gridded | authoritative Indian source `[VERIFY access]` |
| **Soil moisture** | NASA SMAP L4 | 9 km, 3-hourly | initial tank state |
| **SAR** | Sentinel-1 GRD | ~10–20 m | post-event mapping (cloud ke aar-paar) |
| **Optical** | Sentinel-2 L2A | 10 m | mapping jab cloud na ho |
| **Land cover** | ESA WorldCover | 10 m | susceptibility feature |
| **Geology** | GSI Bhukosh | vector | lithology `[VERIFY format]` |
| **Landslide inventory** | GSI Bhukosh + NASA COOLR | point/polygon | training labels |
| **Buildings/roads/POIs** | OpenStreetMap | vector | exposure, chainage |
| **Population** | WorldPop | 100 m | exposed-population estimate |
| **Earthquakes** | National Center for Seismology | catalogue | seismic-weakening term `[VERIFY API]` |

`[VERIFY]` = confirm nahi kiya ja saka. **Presentation se pehle khud verify karo.**

---

## Do data rules jo tod nahi sakte

**1. Rainfall ko Mean Annual Precipitation (MAP) se normalise karo.**
100 mm/din Dehradun ke paas disaster hai, Sohra mein normal Tuesday
(~11,000–12,000 mm/saal). Poore NER par ek absolute threshold **galat** hai.
Feature ye hona chahiye: *local MAP ka kitna fraction*.

**2. Geological province se stratify karo.**
Himalayan (Sikkim, Arunachal) / Indo-Burman Ranges (Mizoram, Manipur, Nagaland —
shale, bedding slope se bahar dipping) / Shillong Plateau (Precambrian gneiss,
patli mitti hard rock par). **Teen alag mechanism se failure hoti hai.**
Ek model teeno par generalise nahi karega.

---

## Folder structure (jab data download hoga)

```
data/
├── sample/            <-- ye git mein hai (mock, chhote)
├── raw/               <-- gitignored: jo download kiya, waise hi
│   ├── dem/
│   ├── rainfall/
│   ├── osm/
│   └── worldpop/
├── processed/         <-- gitignored: jo humne banaya
│   ├── slope_units/
│   └── attributes/
└── README.md          <-- ye file
```

**Har download ke saath likhna:** URL, date, licence, aur citation. Ye
`ARCHITECTURE.md §24` ka rule hai — bina citation koi number slide par nahi jaayega.
