# Riya ke TERRAGUARD doc par review — 4 September 2026

Ye `TERRAGUARD.docx` (4 Sept, frontend report) ka review hai, backend ke
**asli database aur asli API response** ke against. Demo kal hai, isliye
maine har cheez ko do hisson mein baanta hai: **kal se pehle theek karna
hai** aur **theek hai, rehne do**.

Pehle saaf baat: **architecture tumne sahi samjha hai.** Human-in-the-loop
pipeline, probability ≠ risk wala Golden Principle, two-step authorization
gate, CAP 1.2 ke fields — ye chaaron `docs/ARCHITECTURE.md` se match karte
hain aur inhi par poora project khada hai. Workspaces ka breakdown bhi
achha hai. Problem architecture mein nahi hai. Problem **numbers** mein hai.

---

## 1. Sabse pehle — ek rule jo poore project par lagta hai

`docs/ARCHITECTURE.md` §1 mein ye likha hai aur ye negotiable nahi hai:

> Do not fabricate geographic coordinates. Do not fabricate population
> numbers. Never present simulated or demo values as real measurements.

Doc mein bahut saare number aise hain jo **kahin se aaye hi nahi hain** —
na database se, na kisi source se. Demo mein judge ka pehla sawaal hi
"ye number kahan se aaya?" hota hai, aur uska jawab "maine daal diya tha"
nahi ho sakta.

Ye tumhari galti se zyada ek aadat ki baat hai — doc impressive lag raha
hai isliye numbers bade daal diye. Par is project ka poora point yahi hai
ki hum **jo nahi jaante woh bolte nahi**. Agar hum bhi bade number bana
denge toh hum baaki teams se alag kya kar rahe hain?

---

## 2. Kal se pehle theek karna hai

### 2.1 "2,410 micro-catchment slope units"

Database mein **5** slope units hain. Paanch. Aur teenon exposure wale
predictions milakar `risk/current` **3 features** deta hai.

```
AZ-0964  Durtlang    58.1 ha
AZ-1088  Bawngkawn    9.3 ha
AZ-1142  Melthum     19.7 ha
AZ-1147  Melthum     16.5 ha
AZ-1203  Chaltlang   40.7 ha
```

Saare `is_mock: true` hain — hand-drawn polygons, DEM se nikale hue nahi.

Doc mein likha hai "AZ-1001 to AZ-1088", jo khud 88 ids ka range hai, 2,410
ka nahi. Matlab number apne aap se hi nahi mil raha.

**Karo ye:** UI mein jo bhi count dikhata ho, woh `summary.total_slope_units`
se aaye — API se, hardcoded nahi. Aaj woh **3** dega. Teen dikhana sharm ki
baat nahi hai; 2,410 dikhakar ek click par khaali screen aana sharm ki baat
hai.

### 2.2 "4 High-Risk units, 7 pending officer reviews"

Asli `summary` ye hai (abhi capture kiya hua, banaya hua nahi):

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

Ye poora object `GET /api/v1/risk/current?district=aizawl` se aata hai.
Dashboard ke saare counters isi se bharo.

### 2.3 AZ-1088 aur AZ-1042 ke numbers

Doc mein:

| Doc kya kehta hai | Asli value |
|---|---|
| AZ-1088 — "Upper Chite Valley Catchment" | ward `Bawngkawn` |
| AZ-1088 — failure probability **88%** | `0.95` |
| AZ-1042 — "Ramhlun North", 91%, ~75 residents | **AZ-1042 exist hi nahi karta** |

Golden Principle wala example bilkul sahi soch hai, bas asli units use karo:

```
AZ-1088   probability 0.95   risk LOW    "No exposed population identified in runout envelope"
AZ-1142   probability 0.72   risk HIGH   "Estimated potentially exposed population: 120"
AZ-1147   probability 0.68   risk HIGH   "Estimated potentially exposed population: 61"
```

Ye asli mein aur zyada strong example hai. AZ-1088 ki probability **sabse
zyada** hai (0.95) aur risk **LOW** hai. AZ-1142 ki probability usse **kam**
hai (0.72) aur risk **HIGH** hai. Yahi slide par dikhana hai — do row, aur
baat khatam. Banaye hue 88%/91% se ye ulta-pulta lagta hai.

Aur `population_label` ko **as-is print karo**. "120 residents affected"
mat likhna. Backend jo string bhejta hai — "Estimated potentially exposed
population: 120" — wahi dikhana. Ye wording jaan-boojh kar aisi hai.

### 2.4 Sensor telemetry — ye poora section hata do ya "planned" likho

Doc mein hai: Automated Rain Gauges, vibrating-wire piezometers (kPa),
borehole inclinometers (mm/hr displacement), IMD Doppler Weather Radar,
"live sensor network health".

**Hamare paas ek bhi sensor nahi hai.** Na koi gauge, na piezometer, na
radar feed. `MonitoringView.tsx` agar ye numbers dikha raha hai, toh woh
numbers kahin se nahi aa rahe.

Judge ka sawaal seedha aayega: "ye piezometer kahan laga hai?" Uske baad
poora demo shak ke ghere mein aa jaata hai — sahi cheezein bhi.

**Do options hain, dono theek hain:**
- View hata do.
- Ya rakho, par upar bada likho **"PLANNED — no sensor network is deployed.
  Values shown are illustrative."** aur har number ke saath dash (`—`)
  dikhao, fake reading nahi.

Doosra option better hai — roadmap dikhana strength hai, jhooth bolna nahi.

### 2.5 "Coordinating Agencies: GSI • NDMA" — ye sabse zaruri hai

Title page par likha hai ki GSI aur NDMA coordinating agencies hain, aur
document ka classification "Official Operational Reference" hai.

**Ye hata do, pehle.** Humne in dono mein se kisi se baat nahi ki hai. Kisi
government agency ka naam apne intern prototype par "coordinating agency"
likhna misrepresentation hai — aur ye woh cheez hai jo demo ke baad bhi
problem ban sakti hai.

Jo sach hai aur waise bhi achha lagta hai:

> **Reference standards:** GSI landslide susceptibility zonation
> methodology, NDMA landslide risk management guidelines, OASIS CAP 1.2.
> **Status:** Internal prototype. Not an operational system.

CAP 1.2 wali line rakh sakti ho — woh ek public open standard hai jiske
against humne genuinely likha hai.

### 2.6 "Cryptographic officer sign-off" / "unique cryptographic alert ID"

Abhi koi cryptography nahi hai. Signing nahi hai, key nahi hai. V13 mein
audit log aayega, par woh bhi crypto signature nahi hai.

"Officer sign-off with full audit trail" likho — jo sach hai aur kaafi hai.

### 2.7 Four-channel dissemination gateway

Cell Broadcast (DoT/C-DOT) "overrides do-not-disturb", NDMA Sachet push,
solar acoustic sirens, Mizoram Police/SDRF ko VHF radio.

In chaaron mein se **ek bhi integration nahi hai**. V14 mein ek *mock* SMS
sender banega, bas.

Ye section rakhna hai toh heading badal do: **"Dissemination targets
(design, not implemented)"** aur har channel ke aage `NOT CONNECTED` badge.
Demo mein bolna: "ye chaar rastey design kiye hain; prototype mein alert
CAP XML tak jaata hai aur mock SMS par rukta hai." Ye honest bhi hai aur
sochne-samajhne wala bhi lagta hai.

### 2.8 "Grounded in authentic geography of Aizawl District micro-catchments"

Ye backend ki apni disclaimer ke bilkul ulta hai. `/api/v1/slope-units` ka
`meta.disclaimer` literally ye bhejta hai:

> "5 of 5 slope unit(s) are illustrative geometry, not derived from a DEM.
> Do not quote their areas or locations as measurements."

Polygons Aizawl ke **upar** draw kiye gaye hain, par woh asli catchment
boundaries nahi hain. Doc mein "authentic geography" likhne ka matlab hai
ki backend ek baat keh raha hai aur frontend doc doosri.

### 2.9 Demo banner — doc mein hai hi nahi

`meta.is_demo_data` `true` aane par **orange banner compulsory hai**.
`docs/FRONTEND_HANDOFF.md` §5 mein likha hai. Doc mein iska zikr nahi hai,
toh confirm kar lo ki UI mein laga hua hai.

Aur dhyaan rakhna: `DEMO_MODE=false` karke ise band nahi kar sakte. Jab tak
mock polygons load hain, backend `true` hi bhejega. Jaan-boojh kar aisa hai.

---

## 3. Ye sab theek hai — rehne do

- **Human-in-the-loop pipeline** (§3). Detection → queue → officer →
  Confirm / False Positive / Flag for Survey. Bilkul sahi, aur "no public
  alert can be transmitted automatically" wali line project ki sabse
  important line hai.
- **Golden Principle** (§2C). Soch sahi hai, sirf numbers badalne hain.
- **Two-step authorization gate** (§4). Officer ID + statutory reason —
  yahi V12 mein banega.
- **CAP 1.2 payload ke fields** (§4). `identifier`, `sender`, `sent`,
  `status`, `msgType`, `scope`, `info`, `area` — sab standard ke hisaab se
  sahi hain. `status: Exercise` ka option rakhna bahut achhi baat hai; demo
  mein wahi use karna hai, `Actual` kabhi nahi.
- **3-tank SWI model ka description** (§2A). Rudra ke model se match karta
  hai. Half-lives ke asli numbers usse le lena.
- **Snake chart** (§2B). Concept sahi hai. Ek cheez jaan lo: abhi API jo
  `critical_curve` bhejta hai woh **illustrative hardcoded** hai, asli
  calibration nahi — aur trajectory mein sirf **ek point** hai, kyunki time
  series Rudra ke R5 se aayegi. Chart bana lo, par uspar "illustrative"
  likha hona chahiye.
- **Workspaces ka structure**. Aath views ka breakdown demo ke flow ke liye
  kaafi achha hai.

---

## 4. Ek technical cheez — API se connect kiya ya nahi?

Doc mein kahin `fetch`, endpoint ya API ka zikr nahi hai, aur §5 mein "full
fallback resilience" likha hai. Isse lagta hai ki data abhi frontend ke
andar hardcoded hai.

Agar aisa hai toh sabse zaruri kaam yahi hai. Backend **abhi live hai**:

```bash
curl -s "http://localhost:8000/api/v1/risk/current?district=aizawl"
```

Iska shape `data/sample/mock_risk_api_response.json` jaisa hi hai, toh agar
tumne wahi mock use kiya hai toh sirf URL badalna hai. Steps
`docs/FRONTEND_HANDOFF.md` §2 aur §3 mein hain.

**Checkpoint I1** yahi hai: paanch polygon asli API se map par. Screenshot
bhej dena, main verify kar lunga.

---

## 5. Kal ke liye priority order

Time kam hai, toh isi order mein karo:

1. GSI/NDMA "coordinating agencies" hata do, "Internal prototype" likho.
2. Saare counters API ke `summary` se lo. 2,410 hatao.
3. AZ-1042 hatao; AZ-1088 (0.95, LOW) aur AZ-1142 (0.72, HIGH) wala asli
   example lagao.
4. Demo banner check karo.
5. Sensor telemetry aur dissemination gateway par "PLANNED / NOT CONNECTED"
   badge.
6. API se connect (agar abhi nahi hai).

Pehli paanch mein se koi bhi 30 minute se zyada nahi lagni chahiye. Chhathi
sabse bada kaam hai, isliye pehle usko dekho aur baaki commit ke saath
saath karti chalo.

---

## 6. Aakhri baat

Sochne mein mat lena ki doc kharab hai. Structure, pipeline aur standards
ki samajh solid hai — jo cheez seekhne mein sabse zyada time lagti hai wahi
tumne theek ki hai. Numbers theek karna aadhe ghante ka kaam hai.

Aur ek cheez yaad rakhna jo demo mein kaam aayegi: **"humne ye nahi banaya"
bolna kamzori nahi hai.** Judge ke saamne "5 slope units hain, sab mock
polygons hain, aur yahan likha hai ki mock hain" bolna "2,410 units hain"
bolne se **zyada** bharosa banata hai — kyunki pehle wale ko woh verify kar
sakta hai.
