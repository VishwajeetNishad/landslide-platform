# GIT + GITHUB WORKFLOW — Team Guide
## Landslide Platform | Vishwajeet (lead), Rudra (ML), Riya (Frontend)

**Version:** 1.0
**Date:** 2026-09-02
**Kiske liye:** Vishwajeet — tum repo owner ho, tum hi ye rules enforce karoge.

---

## 0. Sabse pehle: Git aur GitHub mein kya farak hai?

Beginner log yahan confuse hote hain. Simple mein:

| | Kya hai | Kahan chalta hai | Example |
|---|---|---|---|
| **Git** | Ek tool jo tumhare code ka **history** rakhta hai | Tumhare **laptop** par | `git commit` |
| **GitHub** | Ek website jahan woh history **online** rakhi jaati hai | **Internet** par | `git push` |

**Analogy:** Git = tumhari personal diary jisme tum roz likhte ho. GitHub = Google Drive jahan tum diary ki copy rakhte ho, taaki dost bhi padh sakein aur laptop kharab ho jaaye toh kaam na jaaye.

**Iska matlab:** `git commit` karne se code GitHub par nahi jaata. Uske liye `git push` karna padta hai. Ye galti sabse zyada hoti hai — log commit karke soch lete hain ki save ho gaya, aur laptop crash hone par sab chala jaata hai.

---

## 1. Git ke 5 zaroori shabd (Hinglish mein)

Ye 5 samajh liye toh 90% Git aa gaya:

**1. Repository (repo)** — Tumhare poore project ka folder + uski poori history. `landslide-platform/` = tumhara repo.

**2. Commit** — Ek "save point". Jaise game mein checkpoint. Har commit mein ek message hota hai jo batata hai kya badla.
```
commit abc123  "V2: FastAPI hello world endpoint add kiya"
commit def456  "V3: PostGIS docker-compose setup"
```
Kabhi bhi kisi bhi purane commit par wapas ja sakte ho. **Isliye Git safety net hai** — kuch tod diya toh ghabrao mat, wapas jaa sakte ho.

**3. Branch** — Code ki ek **alag copy** jisme tum kaam karte ho bina main code ko chhede.

```
main     ●───●───●───────────────●  ← ye hamesha chalta hua code (demo-ready)
              \                 /
v2-fastapi     ●───●───●───────●    ← Vishwajeet yahan kaam kar raha hai
```

Kyun zaroori hai: agar teeno log seedha `main` par kaam karein, toh Rudra ka aadha-toota code tumhare chalte hue code ke saath mix ho jaayega, aur demo ke waqt kuch bhi kaam nahi karega.

**4. Merge** — Branch ka kaam khatam, ab usko `main` mein milana.

**5. Merge conflict** — **Do logon ne ek hi file ki ek hi line badli.** Git confuse ho jaata hai ki kiska rakhe. Ye Git ki galti nahi, planning ki galti hai. §5 mein iska ilaaj hai.

---

## 2. Hamari branch strategy

Teen din hain, isliye simple rakhenge. Do rules:

### Rule 1: `main` hamesha chalta hua hona chahiye

`main` par jo code hai woh **kabhi toota hua nahi hona chahiye.** Kyun? Kyunki agar Day 3 ki raat kuch bigad jaaye, toh tum `main` par wapas jaake demo de sakte ho. `main` = tumhara insurance.

### Rule 2: Har step ke liye ek chhoti branch

Branch ka naam = step ID + kaam. Isse pata chalta hai kaun kya kar raha hai:

```
v0-environment          ← Vishwajeet
v3-postgis-docker       ← Vishwajeet
r3-slope-units          ← Rudra
f2-maplibre-basemap     ← Riya
```

**Branch chhoti rakho** — ek step, ek branch, ek din se kam. Badi branch = bada conflict.

### Poora picture

```
main   ●───────●───────────●───────────●───────────●
       │       ↑           ↑           ↑           ↑
       │    V0 merge    V2 merge   R3 merge    F2 merge
       │       │           │           │           │
       ├─ v0-environment ──┘           │           │
       ├─ v2-fastapi ──────────────────┘           │
       ├─ r3-slope-units ──────────────────────────┘
       └─ f2-maplibre ─────────────────────────────────┘

Har merge ke baad main chalta hua rehta hai.
```

---

## 3. Conflict rokne ka sabse bada trick: folder baant do

**Ye is document ki sabse kaam ki baat hai.**

Merge conflict tab hota hai jab do log **ek hi file** badlein. Toh solution simple hai — **har banda apne folder mein rahe.**

| Folder | Owner | Baaki log |
|---|---|---|
| `backend/` | **Vishwajeet** | Nahi chhedenge |
| `ml/` | **Rudra** | Nahi chhedenge |
| `frontend/` | **Riya** | Nahi chhedenge |
| `docs/` | **Vishwajeet only** | Batana hai toh Vishwajeet ko bolo |
| `docker-compose.yml` | **Vishwajeet only** | — |
| `data/sample/` | **Vishwajeet only** | — |
| `README.md` | **Vishwajeet only** | — |

**Kyun ye kaam karta hai:** teen log teen alag folder mein hain, toh Git ko decide karne ki zarurat hi nahi padti. **Conflicts almost zero ho jaayenge.**

**Shared files ka rule:** `docker-compose.yml`, `docs/`, `data/sample/`, `README.md` — sirf Vishwajeet edit karega. Rudra/Riya ko kuch add karna hai toh **bolenge, khud nahi karenge.** Ye thoda annoying lagega, par Day 3 ki raat conflict se bacha lega.

---

## 4. Roz ke commands — cheat sheet

### 4.1 Naya step shuru karte waqt (har step ke start mein)

```bash
git checkout main
git pull origin main
git checkout -b v3-postgis-docker
```

Line-by-line kya hua:
1. `checkout main` — `main` branch par aa gaye
2. `pull origin main` — GitHub se doosron ka naya kaam download kar liya. **Ye sabse important line hai** — isse tum purane code par kaam nahi karoge
3. `checkout -b <naam>` — nayi branch banayi aur usme chale gaye (`-b` = branch banao)

### 4.2 Kaam ke beech mein (thoda kaam hone par)

```bash
git status
git add backend/
git commit -m "V3: PostGIS docker-compose add kiya"
git push origin v3-postgis-docker
```

1. `status` — kya-kya badla dekho (**hamesha pehle ye chalao**)
2. `add` — jo files commit karni hain woh chuno. `git add .` se bachо — galti se junk file chali jaati hai
3. `commit -m "..."` — save point banao message ke saath
4. `push` — GitHub par bhejo

**Kitni baar commit karein?** Jab bhi ek chhota hissa kaam karne lage. Din mein 5–10 commit normal hai. Ek din ka poora kaam ek commit mein daalna galat hai — kuch toota toh pata nahi chalega kahan.

### 4.3 Step khatam hone par (test pass ho gaya)

```bash
git push origin v3-postgis-docker
```

Phir GitHub website par jaao → **"Compare & pull request"** button dikhega → click karo → PR banao → **Merge** karo.

### 4.4 Merge ke baad safai

```bash
git checkout main
git pull origin main
git branch -d v3-postgis-docker
```

---

## 5. Pull Request (PR) kya hai, aur hum kyun use karenge

**PR = "bhai, mera kaam `main` mein daal do" wali request**, GitHub website par.

**3 din ke hackathon mein PR kyun?** Do wajah:

1. **Record ban jaata hai** — kisne kya kiya, kab. Judge/mentor ko GitHub dikhaoge toh professional lagega.
2. **Tum sab kuch dekh lete ho** — team lead ho tum. PR ke "Files changed" tab mein tum dekh sakte ho ki Rudra ne kya badla, bina uska code manually padhe.

**Hamara PR rule (fast rakhna hai):**
- Apna PR khud merge kar sakte ho (self-merge) — 3 din mein doosre ka wait nahi kar sakte
- **Par:** `main` mein merge karne se pehle **test pass hona chahiye**
- PR ka title = step ID + kaam. Example: `V3: PostgreSQL + PostGIS via Docker Compose`
- PR ke description mein 3 line: *kya kiya, kaise test kiya, kya output aaya*

Ye §23 ka "Definition of Done" hai — **PR description hi tumhara proof hai** ki kaam sach mein hua.

---

## 6. Merge conflict aa gaya toh? (ghabrao mat)

Conflict aane par Git file mein aisa likh deta hai:

```
<<<<<<< HEAD
    port = 8000          ← main par jo hai
=======
    port = 8080          ← tumhari branch par jo hai
>>>>>>> v3-postgis-docker
```

**Kya karna hai:**
1. File kholo, teen marker (`<<<<<<<`, `=======`, `>>>>>>>`) dhundo
2. Decide karo kaunsa sahi hai (ya dono mila do)
3. **Teeno marker lines delete karo** — ye code mein rehne nahi chahiye
4. `git add <file>` phir `git commit`

**Confuse ho gaye toh yaad rakho:** conflict se code delete nahi hota. Dono versions safe hain. Bas tumhe chunna hai. Aur agar poori tarah phas jao:

```bash
git merge --abort
```

Ye merge cancel kar dega, sab pehle jaisa. Phir mujhse pooch lena.

---

## 7. `.gitignore` — kya GitHub par kabhi nahi jaana chahiye

**Ye V1 step mein sabse zaroori file hai.** `.gitignore` mein jo likha hoga, Git usko ignore karega.

**Kyun critical hai:**

| Cheez | Kyun ignore karein |
|---|---|
| `data/` (DEM, rainfall files) | DEM file 100+ MB ki hoti hai. **GitHub 100 MB se badi file reject karta hai.** Aur galti se push hui toh history se hataana bahut mushkil hai |
| `.env` (passwords, API keys) | **Password kabhi GitHub par nahi.** Ek baar push hua toh history mein hamesha reh jaata hai, delete karne par bhi |
| `__pycache__/`, `*.pyc` | Python ki auto-generated junk files. Har machine par alag banti hain → guaranteed conflict |
| `node_modules/` | Riya ke React packages. Hazaron files, GBs mein. `package.json` se dobara ban jaate hain |
| `.venv/`, `conda` env | Environment machine-specific hota hai. `requirements.txt` se dobara ban jaata hai |
| `*.tif`, `*.geojson` (bade) | Bade geo files. `data/sample/` ke chhote mock files exception hain |

**Golden rule:** Repo mein **code + config + chhote sample files** jaate hain. **Bada data aur secrets nahi.** Rudra ko DEM chahiye toh woh download script chalayega, file GitHub se nahi laayega.

---

## 8. Commit message kaise likhein

**Bura:**
```
update
fix
kaam kiya
asdf
```

**Achha:**
```
V3: PostGIS docker-compose add kiya
V8: risk_level function — probability x exposure matrix
V8: risk_level ke unit tests (LOW aur HIGH dono case)
R3: slope units WhiteboxTools se generate kiye
F5: snake line chart Recharts se
```

**Format:** `<STEP-ID>: <kya kiya>`

**Kyun ye format:** Step ID hone se `git log` dekhkar turant pata chalta hai kaunsa step kab hua. Aur team lead ke naate tum progress track kar sakte ho bina kisi se poochhe.

---

## 9. Repo setup — V1 mein kya hoga (preview)

V1 step par ye karenge (abhi nahi, batane ke liye likh raha hoon):

1. **GitHub par repo banao** — naam `landslide-platform`, **Private** rakho
   *Kyun private?* Hackathon ka kaam hai. Baad mein public kar sakte ho. Private mein bhi collaborators add kar sakte ho.
2. **Rudra aur Riya ko collaborator add karo** — Settings → Collaborators → Add people. Bina iske woh push nahi kar payenge.
3. **Local folder ko repo se jodo** — `git init`, `git remote add origin ...`, pehla push
4. **`.gitignore` likho** — §7 ke hisaab se
5. **Folder structure banao** — khaali folders + `README.md`
6. **Teen mock JSON files** `data/sample/` mein — taaki teeno parallel chal sakein
7. **Rudra/Riya repo clone karein** — `git clone <url>`

**Ek cheez jo main assume kar raha hoon:** tumhara GitHub account already bana hua hai. Nahi hai toh V1 se pehle bana lena (2 minute ka kaam, github.com par).

---

## 10. Team ko batane wale Git rules (ye message bhej do)

> **Git rules — teeno follow karein:**
>
> 1. **Apne folder mein raho.** Rudra → `ml/`, Riya → `frontend/`, Vishwajeet → `backend/`. Doosre ka folder nahi chhedna.
> 2. **`docs/`, `docker-compose.yml`, `data/sample/`, `README.md` sirf Vishwajeet edit karega.** Kuch add karna hai toh bolo.
> 3. **Kaam shuru karne se pehle hamesha:** `git checkout main` → `git pull origin main` → `git checkout -b <step-id>-<kaam>`
> 4. **Kabhi seedha `main` par commit nahi karna.**
> 5. **Roz raat push karo**, kaam adhoora ho toh bhi. Laptop kharab hone par kaam nahi jaana chahiye.
> 6. **Commit message format:** `R3: slope units generate kiye`
> 7. **`data/` aur `.env` kabhi commit nahi.** Bade file aur password GitHub par nahi jaate.
> 8. **Conflict aaye toh Vishwajeet ko bolo.** Akele solve karne ki koshish mein code kharab ho sakta hai.

---

## 11. Din ke hisaab se Git rhythm

**Subah (standup ke saath, 2 min):**
```bash
git checkout main && git pull origin main
```
Sabse pehle ye. Isse raat mein doosron ka kaam tumhare paas aa jaayega.

**Din bhar:** apni branch par kaam, chhote-chhote commits.

**Raat (standup ke saath):**
```bash
git push origin <apni-branch>
```
Sab push karein — **kaam adhoora ho toh bhi.** Push = backup.

**Checkpoint par (I1, I2, I3):** sab apni branch `main` mein merge karein, phir sab `main` pull karein. Yahan poori team ka code ek saath aata hai — **yahi asli integration test hai.**

---

## 12. Do emergency commands (Day 3 ki raat ke liye)

**"Maine kuch tod diya, wapas jaana hai":**
```bash
git stash          # abhi ka kaam side mein rakh do
git checkout main  # chalte hue code par wapas
```
Kaam gaya nahi — `git stash pop` se wapas aa jaayega.

**"Demo se pehle main par chalta hua code chahiye":**
```bash
git checkout main
git pull origin main
```
`main` hamesha chalta hua hai (Rule 1) — **isiliye woh rule hai.**

---

## 13. GitHub ko demo mein kaise use karein (bonus)

Presentation ke waqt ye dikhana professional lagta hai:

- **Commit history** — "teen din mein 60 commits, teen developers"
- **Pull requests** — "har feature review hoke merge hua"
- **`docs/` folder** — ARCHITECTURE.md, API_CONTRACT.md, IMPLEMENTATION_STEPS.md
- **Folder structure** — saaf separation of concerns

Judge ko dikhta hai ki tumne **software engineer ki tarah kaam kiya**, sirf code likhkar demo nahi banaya. Ye SIH mein points deta hai.

Ek chhoti baat: repo ko **Day 3 se pehle public** kar dena agar judge link dekhna chahe. Aur `README.md` mein setup instructions likhna — koi bhi clone karke chala sake.

---

## 14. Agla kadam

**Step V0** — Miniforge + Python 3.11 environment.

V0 mein Git ka kaam nahi hai (kyunki repo V1 mein banega) — par uske baad **har step mein Git section hoga:** exact commands, kya push karna hai, PR mein kya likhna hai, aur team ko kya batana hai.
