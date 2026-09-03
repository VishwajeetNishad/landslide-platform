# PROGRESS LOG

A step-by-step record. An entry is added after each step is implemented **and**
verified. Newest at the bottom.

Every entry has the same four sections:
`What was done · How it was tested · What broke or was learned · Pending`

The full list of steps is in `docs/IMPLEMENTATION_STEPS.md`
(V0–V14 backend, R1–R8 ML, F1–F8 frontend).

---

## V0 — Python 3.11 environment ✅ 2026-09-02

**What was done**

    Installed Miniforge and created the Python 3.11 conda environment
    "landslide". Brought up the geospatial stack: gdal, rasterio,
    geopandas, shapely, pyproj. Python 3.14 was deliberately avoided.

**How it was tested**

    python -c "import rasterio, geopandas, shapely, pyproj; print('ok')"
    -> ok

**What broke or was learned**

    The environment was built with `conda create` directly rather than
    `conda env create -f environment.yml`, so the yml's pip section
    (fastapi, shap, ultralytics) never ran. A ModuleNotFoundError showed
    up later. Lesson: always build the environment from environment.yml,
    otherwise the pip section is silently skipped.

    Geospatial packages must come from conda-forge only. Installing them
    with pip on Windows produces "DLL load failed".

**Pending**

    Nothing. This environment is now for ml/ (Rudra) only — the backend
    moved to Node (see V2).

---

## V1 — Repository structure, Git, contracts ✅ 2026-09-02

Commit `0a2d08f`

**What was done**

    Created the private GitHub repository VishwajeetNishad/landslide-platform.
    Folder skeleton: backend/ ml/ frontend/ data/ docs/
    .gitignore blocking data/, .env, node_modules/, __pycache__
    .env.example — a template with no passwords
    Four documents: ARCHITECTURE, IMPLEMENTATION_STEPS, API_CONTRACT,
    GIT_WORKFLOW
    Three mock files in data/sample/ so all three developers can work
    in parallel

**How it was tested**

    git log --oneline           -> commit present
    git status -sb              -> ## main...origin/main (in sync)
    git ls-files | wc -l        -> 30 files
    git check-ignore -v .env    -> BLOCKED
    python -m json.tool data/sample/*.json  -> JSON OK

**What broke or was learned**

    GH007: "Your push would publish a private email address" — GitHub
    refused to push the real email address. Fixed by setting the noreply
    address and running `git commit --amend --reset-author --no-edit`.
    The commit hash changed (1b6a8a8 -> 0a2d08f) because a Git hash is
    derived from content plus author plus timestamp.

    Empty folders do not appear on GitHub, so .gitkeep files were needed.

**Pending**

    Add Rudra and Riya as repository collaborators (Vishwajeet).

---

## V2 — Node.js backend base ✅ 2026-09-03

Commits `4c5b3dc` -> merge `2147f06`, then `a75f1b5` and `c3e26b6`

**What was done**

    Moved the backend from Python/FastAPI to Node.js 22 + Fastify 5.
    Reason: the API layer is only HTTP, JSON and SQL; the spatial work
    happens inside PostGIS, and the backend never touches a raster.
    Choosing Node put two of the three developers (Vishwajeet and Riya)
    in one language. The raster work (runout) moved into ml/.

    Files:
      backend/package.json          Fastify 5, @fastify/cors, swagger
      backend/src/core/config.js    reads .env, plus toBool()
      backend/src/app.js            builds the app (does NOT listen)
      backend/src/routes/meta.js    GET / and GET /health
      backend/src/server.js         listen + graceful shutdown
      backend/test/meta.test.js     6 tests

    Documentation cleanup (a75f1b5): Alembic -> numbered SQL migrations,
    Pydantic -> Fastify JSON Schema, Celery -> node-cron.
    Not one line of API_CONTRACT.md had to change — JSON is
    language-agnostic, which is the whole point of that boundary.

    Team onboarding document (c3e26b6): docs/TEAM_ONBOARDING.md — the
    exact first commands, traps and UI rules for Rudra and Riya.

**How it was tested**

    npm test        -> 6 pass, 0 fail, ~430 ms
    npm audit       -> 0 vulnerabilities
    GET /health     -> {"status":"ok","checks":{"api":"ok","database":"not_configured"}}
    GET /           -> isDemoData: true, disclaimer present
    GET /docs       -> 200, Swagger UI opens
    unknown route   -> 404, no crash
    CORS header     -> access-control-allow-origin: http://localhost:5173

**What broke or was learned**

    "Cannot find module '...backend\test'" — with `node --test test/`,
    Node treated the directory as a file. Fixed with a glob:
    node --test "test/**/*.test.js"

    npm audit reported 1 HIGH: path traversal in @fastify/static, pulled
    in transitively through @fastify/swagger-ui. `npm audit fix --force`
    was NOT run, because it performs blind major-version jumps. Pinned
    ^6.1.1 manually instead -> 0 vulnerabilities.

    toBool() — a real bug caught before it could bite. Everything from
    process.env arrives as a string, and the string "false" is truthy in
    JavaScript. Without toBool(), setting DEMO_MODE=false in .env would
    have left demo mode ON — meaning fabricated numbers presented as a
    real forecast, with no banner. A test pins this down:
    typeof body.isDemoData === 'boolean'.

    /health does not report a false "ok". The database was not connected
    yet, so it said 'not_configured' plainly. A false "ok" is the most
    dangerous answer: Docker is happy, monitoring is happy, and the API
    fails on every request.

    pkill and kill -TERM did not work in Windows Git Bash — the POSIX
    signal never reached the background Node process. PowerShell
    Stop-Process was used instead.

**Pending**

    ⚠️ Graceful shutdown is written but NOT verified. SIGTERM could not
    be delivered on Windows. To be tested in V3.

    Why this matters: V13 dispatches alerts. Killing the process
    mid-dispatch means an incomplete audit log, which means no record of
    who sent the alert.

---

## V3 — Docker Compose + PostgreSQL + PostGIS ✅ 2026-09-03

Sub-steps: V3.1 install · V3.2 disk relocation · V3.3 compose file ·
V3.4 container + PostGIS · V3.5 Node connection · V3.6 graceful shutdown

**What was done**

    V3.1  Installed Docker Desktop 4.89.0 via winget.
          CLI 29.7.2, Compose v5.5.0. WSL2 and Ubuntu were already
          present, HypervisorPresent = True, RAM 13.7 GB — so the
          number-one Docker-on-Windows blocker (missing WSL2) was
          already clear.

    V3.2  Relocated the disk image from C: to D:. Reason: C: had only
          11.1 GB free, and after the install it dropped to 8.2 GB — so
          the concern was real, not theoretical. All three drives were
          confirmed "Fixed" first (hosting Docker data on removable
          media is unsafe). Setting key: CustomWslDistroDir.
          After the move: docker_data.vhdx 1.71 GB and main/ext4.vhdx
          100 MB under D:\DockerDesktopWSL, nothing left under
          C:\Users\vishw\AppData\Local\Docker. C: recovered 8.2 -> 9.9 GB.
          This was done BEFORE pulling the ~450 MB PostGIS image, because
          relocation recreates Docker's storage from scratch.

    V3.3  Wrote docker-compose.yml with only the `db` service.
          Node and Vite stay on the host: on Windows, file-watching
          inside Docker has to cross the Windows/Linux VM boundary and is
          slow. A database does no file-watching, so it containerises
          cleanly.
          image: postgis/postgis:16-3.4 — the tag is pinned. With
          `latest`, PostgreSQL 17 would eventually arrive and refuse to
          read the existing data directory.
          No password in the file. ${POSTGRES_PASSWORD:?...} pulls it
          from .env and fails immediately with a clear message if unset.
          Port published as 127.0.0.1:5432:5432 — without the prefix
          Docker publishes on every interface, putting the database on
          the venue or hostel WiFi.
          Named volume pgdata — `down` keeps the data, only `down -v`
          deletes it.
          Healthcheck pg_isready — "container running" is not the same
          as "database ready".
          shm_size 256mb — the 64 MB container default makes large
          spatial joins fail with "could not resize shared memory
          segment".

          Created .env with a password from `openssl rand -hex 24`.
          Hex specifically, because it contains no @ : / # characters,
          which would break DATABASE_URL.
          git check-ignore -v .env -> .gitignore:10 (blocked).

    V3.4  docker compose up -d. Container reported healthy.
          PostgreSQL 16.4, PostGIS 3.4 (USE_GEOS=1 USE_PROJ=1).
          SRIDs 4326, 32646 and 32645 all present in spatial_ref_sys.

    V3.6  Verified graceful shutdown against a real SIGTERM, and in doing
          so found and fixed a real bug. See "What broke" below.
          Added forceCloseConnections: true in app.js, plus a re-entrancy
          guard and an 8-second hard deadline in server.js.

    V3.5  Connected Node to the database. Installed `pg`
          (0 vulnerabilities).
          New file backend/src/db/pool.js — one shared pool, plus
          query(), withTransaction(), checkDatabase() and closePool().
          Removed the hardcoded fake password from config.js. It is now
          databaseUrl: process.env.DATABASE_URL ?? null
          Added an onClose hook in app.js so app.close() also closes the
          pool. The hook lives in app.js rather than server.js because
          the tests call app.close() too; in server.js the pool would
          stay open after tests and the open socket would keep
          `node --test` from exiting.
          /health now returns HTTP 503 and status 'degraded' whenever a
          dependency is unusable.

          Both npm scripts now use --env-file-if-exists=../.env rather
          than --env-file. `npm start` previously loaded no .env at all,
          so a non-watch local run had no DATABASE_URL and /health
          reported 'not_configured' for no good reason. Plain
          --env-file cannot be used either: it is a hard error when the
          file is absent, which would break the container (where the
          variables come from the environment, not from a file) and
          break a fresh clone before .env exists.

**How it was tested**

    docker compose config   -> schema valid; ${POSTGRES_USER} correctly
                               interpolated into the healthcheck
                               (pg_isready -U landslide -d landslide),
                               host_ip 127.0.0.1, shm_size 268435456
    docker compose ps       -> Up (healthy), 127.0.0.1:5432->5432
    SELECT version()        -> PostgreSQL 16.4
    SELECT PostGIS_Version() -> 3.4 USE_GEOS=1 USE_PROJ=1

    Spatial chain test (synthetic geometry inside the mock bbox):
      ST_Intersection -> ST_Transform(32646) -> ST_Length  = 1019.2 m
      the same length measured in 4326                     = 0.01
      ST_LineLocatePoint                    = 0.2 to 0.6 (chainage)

    npm test                       -> 7 pass, 0 fail, 438 ms
    npm start (no --watch)          -> HTTP 200, database ok,
                                       postgis 3.4.3 in 81 ms
    /health with .env loaded        -> HTTP 200, database ok,
                                       postgis 3.4.3
    /health with the database down  -> HTTP 503, database unavailable,
                                       answered in 42 ms (no hang)
    node --env-file-if-exists=<missing file>
                                    -> "not found. Continuing without it."
                                       and the process runs
    node --env-file=<missing file>  -> hard error, process refuses to
                                       start (which is why the flag was
                                       changed)

    Graceful shutdown, tested inside a Linux container so that a real
    SIGTERM could be delivered (Node on Windows cannot receive one):
      before the fix, kill -TERM  -> both shutdown log lines appeared and
                                     the process STAYED ALIVE;
                                     docker stop -> exit code 137 (SIGKILL)
      after the fix,  kill -TERM  -> process exited in 664 ms
      after the fix,  docker stop -> completed in 719 ms,
                                     EXIT CODE 0,
                                     log: "SIGTERM received -- shutting
                                     down gracefully" / "Database pool
                                     closed" / "Shutdown complete"
    Node was run as PID 1 for that last test, so `docker stop` signalled
    it directly, exactly as in a real deployment.

**What broke or was learned**

    PowerShell 5.1 does not support `&&` at all (it arrived in
    PowerShell 7), and Windows has no `grep`. Running the verification
    command in PowerShell produced "token '&&' is not a valid statement
    separator". That was a shell mismatch, not a failed install.
    Lesson: always say explicitly "in Git Bash, not PowerShell".

    "docker: command not found" in a fresh Git Bash — the machine PATH
    did contain the entry and docker.exe was present. The cause is that
    explorer.exe caches its environment block at login, so merely
    restarting a terminal inherits the stale environment. Fix:
      echo 'export PATH="$PATH:/c/Program Files/Docker/Docker/resources/bin"' >> ~/.bashrc
    After a Windows restart this line becomes a harmless duplicate.

    Installing Docker does not start the daemon. Without launching
    Docker Desktop, the CLI reports "failed to connect to the docker API
    at npipe:...". The CLI does nothing on its own; it is only a remote
    for the daemon.

    A mistake of mine: to verify the disk relocation I suggested
    `docker info | grep "docker root dir"`. It returned /var/lib/docker,
    which is the path INSIDE the Linux VM and says nothing about the
    Windows location. The correct verification was locating the .vhdx
    files and reading settings-store.json.

    A second mistake: I had written that V3.6 would verify graceful
    shutdown via `docker stop`. Wrong — Node runs on the host, not
    inside the container, so `docker stop` sends SIGTERM to PostgreSQL,
    not to Node. The eventual test therefore ran Node in a throwaway
    Linux container of its own.

    V3.6 FOUND A REAL BUG — the one V2 had left open, and one that
    Windows can never surface.

    Symptom: send a real SIGTERM and both shutdown lines appear in the
    log — "SIGTERM received" and "Database pool closed" — and the process
    stays alive anyway. `docker stop` then waits its default 10 seconds
    and sends SIGKILL, recording exit code 137.

    Cause: app.close() stops the listener but does not destroy sockets
    that are idle on HTTP keep-alive. Those open handles keep the event
    loop alive, so the `process.exit(0)` sitting after `await
    app.close()` is never reached. Any client that had made even one
    request — a browser tab, curl, Riya's dashboard — leaves such a
    socket behind.

    Why it hid for so long: the log looked perfect. Both lines printed,
    in order. Nothing indicated failure except the exit code, and on
    Windows the test could not run at all, because Node's documentation
    states plainly that SIGTERM is unsupported there. The bug was only
    reachable by giving the same code a real signal in Linux.

    Why it mattered: in a Linux deployment every restart would SIGKILL
    the backend. V13 dispatches alerts, and a SIGKILL in the middle of a
    dispatch produces exactly the half-written audit log — an alert sent
    with no record of who authorised it — that this project must never
    produce.

    Fix, three parts:
      forceCloseConnections: true in app.js — destroy idle keep-alive
        sockets on close
      a re-entrancy guard in server.js — pressing Ctrl+C twice used to
        run the whole shutdown path twice and close the pool underneath
        itself
      an 8-second hard deadline — a genuinely stuck request would
        otherwise hang shutdown forever, which relocates the problem
        rather than solving it. 8 s is deliberately under Docker's 10 s
        patience, so we exit on our own terms instead of being killed.

    Along the way, two dead ends worth recording:
      Bind-mounting the host's backend/ into a Linux container made
      `import` of app.js hang indefinitely. Reading thousands of
      node_modules files across the Windows/Linux VM boundary is
      pathologically slow — the very reason V3.3 kept Node on the host.
      Solved by `docker cp`-ing the code in and running npm install
      inside Linux.
      With APP_ENV=development, pino-pretty runs in a worker thread whose
      output is buffered when stdout is not a TTY, so a SIGKILLed process
      lost its logs entirely and the container appeared to produce
      nothing. Switching to APP_ENV=production gives raw JSON on the main
      thread, which is what Docker deployments use anyway.

    Git Bash bracketed-paste artefacts (^[[200~) mangled a pasted
    command twice — "bash: \E[200~mkdir: command not found". A terminal
    problem, not a code problem.

    npm test once took 8.7 s where it had previously taken 430 ms.
    Rather than guessing, each phase was measured: import 163 ms,
    build 241 ms, health 14 ms, close 0 ms — the app itself was fast.
    The 8.7 s was a cold cache immediately after `npm install pg`; the
    next run took 531 ms. Lesson: measure per phase instead of
    speculating about a slow test.

    Removed the fake fallback password from config.js for two reasons:
    a fake credential sitting in source eventually becomes someone's
    real one, and with a fallback present databaseUrl was never empty,
    so /health could never report 'not_configured' — that state was
    unreachable.

    V2's /health response was itself a lie: it returned status 'ok' and
    HTTP 200 while database was 'not_configured'. It now returns 503
    and 'degraded'. "Green dashboard, dead service" is the most
    expensive failure mode there is. The test was rewritten to assert
    the INVARIANT rather than a specific value: all dependencies ok
    <=> status 'ok' and HTTP 200.

    pool.on('error') is mandatory. `pg` reports errors on idle clients
    as an 'error' event on the pool, and Node's rule is that an 'error'
    event with no listener crashes the process. Without the handler,
    `docker compose restart db` would kill the backend silently — and
    that would happen the night before the demo.

    PostGIS has to be checked separately from PostgreSQL. "PostgreSQL is
    running but the PostGIS extension is missing" is a real failure; in
    that state SELECT 1 passes happily and every spatial query fails.

    /health returns only the error CODE, never the full PostgreSQL
    error, because health endpoints are frequently exposed without
    authentication. The full error goes to the server log.

**Pending**

    Ctrl+C on Windows still cannot be used to demonstrate this. `npm run
    dev` runs `node --watch`, and watch mode supervises the app in a
    child process, so Ctrl+C goes to the supervisor rather than to our
    handler. The handler itself is now verified under a real signal in
    Linux, which is the environment that matters; on Windows, use the
    container test above rather than trusting Ctrl+C.

    D:\docker was created but Docker never used it (it made its own
    D:\DockerDesktopWSL). Harmless; delete it if you like.

---
