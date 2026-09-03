# PROGRESS LOG

Step-by-step record. Har step complete aur verified hone ke baad yahan entry
add hoti hai. Latest sabse neeche.

Format har entry mein:
  Kya kiya · Kaise test kiya · Kya toota ya seekha · Pending

Steps ki poori list `docs/IMPLEMENTATION_STEPS.md` mein hai (V0–V14 backend,
R1–R8 ML, F1–F8 frontend).

---

## V0 — Python 3.11 environment ✅ 2026-09-02

**Kya kiya**

    Miniforge install kiya, Python 3.11 ka conda env "landslide" banaya.
    Geo stack chalu: gdal, rasterio, geopandas, shapely, pyproj.
    Python 3.14 jaan-boojh kar avoid kiya.

**Kaise test kiya**

    python -c "import rasterio, geopandas, shapely, pyproj; print('ok')"
    -> ok

**Kya toota ya seekha**

    Env `conda create` se seedha banaya, `environment.yml` se nahi. Isliye
    yml ka pip section (fastapi, shap, ultralytics) kabhi chala hi nahi.
    Baad mein ModuleNotFoundError aaya. Seekh: env hamesha
    `conda env create -f environment.yml` se banao, warna pip section skip
    ho jaata hai.

    Geo packages sirf conda-forge se — pip se lene par Windows par
    "DLL load failed" aata hai.

**Pending**

    Kuch nahi. Ye env ab sirf ml/ (Rudra) ke liye hai — backend Node par
    shift ho gaya (dekho V2).

---

## V1 — Repo structure + Git + contracts ✅ 2026-09-02

Commit `0a2d08f`

**Kya kiya**

    GitHub par private repo banaya: VishwajeetNishad/landslide-platform
    Folder skeleton: backend/ ml/ frontend/ data/ docs/
    .gitignore — data/, .env, node_modules/, __pycache__ block kiye
    .env.example — passwords ke bina template
    4 docs likhe: ARCHITECTURE, IMPLEMENTATION_STEPS, API_CONTRACT, GIT_WORKFLOW
    3 mock files data/sample/ mein — teeno developer parallel chal sakein

**Kaise test kiya**

    git log --oneline           -> commit dikha
    git status -sb              -> ## main...origin/main (sync)
    git ls-files | wc -l        -> 30 files
    git check-ignore -v .env    -> BLOCKED
    python -m json.tool data/sample/*.json  -> JSON OK

**Kya toota ya seekha**

    GH007: "Your push would publish a private email address" — GitHub ne
    asli email push hone se roka. Fix: noreply email set karke
    `git commit --amend --reset-author --no-edit`. Commit hash badal gaya
    (1b6a8a8 -> 0a2d08f) kyunki Git hash content + author + time se banta hai.

    Khaali folders GitHub par dikhte nahi — .gitkeep daalna pada.

**Pending**

    Rudra aur Riya ko collaborator add karna (Vishwajeet karega).

---

## V2 — Node.js backend base ✅ 2026-09-03

Commits `4c5b3dc` -> merge `2147f06`, phir `a75f1b5` aur `c3e26b6`

**Kya kiya**

    Backend Python/FastAPI se Node.js 22 + Fastify 5 par shift kiya.
    Wajah: API layer sirf HTTP + JSON + SQL hai; spatial kaam PostGIS ke
    andar hota hai, backend raster ko chhoota hi nahi. Node lene se teen
    mein se do developer (Vishwajeet + Riya) ek language mein aa gaye.
    Raster wala kaam (runout) ml/ mein chala gaya.

    Files:
      backend/package.json          Fastify 5, @fastify/cors, swagger
      backend/src/core/config.js    .env padhta hai + toBool()
      backend/src/app.js            app banata hai (listen NAHI karta)
      backend/src/routes/meta.js    GET / aur GET /health
      backend/src/server.js         listen + graceful shutdown
      backend/test/meta.test.js     6 tests

    Docs cleanup (a75f1b5): Alembic -> numbered SQL migrations,
    Pydantic -> Fastify JSON Schema, Celery -> node-cron.
    API_CONTRACT.md mein ek line badalni nahi padi — JSON language-agnostic hai.

    Team onboarding doc (c3e26b6): docs/TEAM_ONBOARDING.md — Rudra aur Riya
    ke liye exact pehli commands, traps, aur UI rules.

**Kaise test kiya**

    npm test        -> 6 pass, 0 fail, ~430 ms
    npm audit       -> 0 vulnerabilities
    GET /health     -> {"status":"ok","checks":{"api":"ok","database":"not_configured"}}
    GET /           -> isDemoData: true, disclaimer present
    GET /docs       -> 200, Swagger UI khula
    unknown route   -> 404, crash nahi
    CORS header     -> access-control-allow-origin: http://localhost:5173

**Kya toota ya seekha**

    "Cannot find module '...backend\test'" — `node --test test/` mein Node ne
    test ko file samjha. Fix: glob -> node --test "test/**/*.test.js"

    npm audit: 1 HIGH — @fastify/static mein path traversal, transitively
    @fastify/swagger-ui ke through. `npm audit fix --force` NAHI chalaya
    (woh blind major-version jump karta hai). Manually ^6.1.1 kiya -> 0 vulns.

    toBool() — asli bug jo pehle hi ruk gaya. process.env se sab string aata
    hai, aur JS mein string "false" truthy hai. Bina toBool(), .env mein
    DEMO_MODE=false likhne par bhi demo mode ON rehta — matlab fake numbers
    "asli forecast" bolkar dikh jaate, banner ke bina. Test isko pakadta hai:
    typeof body.isDemoData === 'boolean'.

    /health jhootha "ok" nahi bolta. Database abhi laga hi nahi, toh saaf
    'not_configured' bolta hai. Jhootha ok sabse khatarnaak hai — Docker
    khush, monitoring khush, aur API har request par crash.

    pkill / kill -TERM Windows Git Bash mein kaam nahi kiya — POSIX signal
    background Node process tak pahunche hi nahi. PowerShell Stop-Process se
    kaam chalaya.

**Pending**

    ⚠️ Graceful shutdown ka code likha hai par VERIFY NAHI hua. Windows par
    SIGTERM bhej nahi paye. V3 mein Docker (Linux container) par test hoga —
    `docker stop` asli SIGTERM bhejta hai.

    Ye important kyun hai: V13 mein alert dispatch hoga. Dispatch ke beech
    process marna = audit log adhoora = kisne alert bheja pata nahi chalega.

---
