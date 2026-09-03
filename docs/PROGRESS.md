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

## V4.1 — migration runner ✅ 2026-09-03

**What was done**

    backend/src/db/migrate.js plus backend/src/db/migrations/, and an
    `npm run migrate` script. No ORM and no migration library: the schema
    is mostly PostGIS types, GiST indexes, CHECK constraints and one
    trigger, and those are exactly the parts an ORM expresses badly or
    not at all. A numbered .sql file IS the schema — what you read is
    what the database gets.

    The runner gives five guarantees, each of which is tested below:
      order      three-digit zero-padded names, plus an explicit numeric
                 sort because readdir() promises no order at all
      once only  applied versions are recorded in schema_migrations
      all or none each migration runs in its own transaction. Postgres
                 makes DDL transactional, so a migration that fails
                 halfway leaves nothing behind
      not edited the sha256 of every applied file is stored; editing an
                 applied migration stops the next run
      one runner a session-level advisory lock, so two people running
                 `npm run migrate` at once cannot both apply 007

    schema_migrations is created directly rather than as migration 000,
    because we would have to read the table to know whether to create it.

    001_extensions.sql — CREATE EXTENSION IF NOT EXISTS postgis. The
    Docker image already creates it in the default database, so this is a
    no-op today; it exists so a fresh or differently named database still
    ends up correct.

**How it was tested**

    Nine checks, all against the running container:

    1 first run             -> applied 001_extensions.sql in 10 ms
    2 second run            -> "Schema is up to date", nothing re-applied
    3 edited applied file   -> REFUSED, printed both checksums, exit 1
    4 file restored         -> up to date again (so the check is on
                               content, not on a timestamp)
    5 file named 7_oops.sql -> REFUSED before touching the database
    6 two files numbered 001 -> REFUSED (duplicate version)
    7 999_broken.sql, which creates a table and then contains invalid
      SQL -> "failed and was rolled back". Verified in psql afterwards:
      canary table left behind = 0, and 999 was NOT recorded in
      schema_migrations. This is the all-or-none guarantee proven rather
      than assumed.
    8 no DATABASE_URL       -> plain message, exit 1, no stack trace
    9 npm test              -> 7 pass, 0 fail, 704 ms (nothing else broke)

    Also verified after every run: advisory locks left behind = 0.

**What broke or was learned**

    The checksum normalises \r\n to \n before hashing. Without that, Git
    on Windows can check a file out with CRLF where Linux gets LF, the
    identical migration would hash differently on the two machines, and
    the runner would wrongly accuse an untouched file of having been
    edited. That would have shown up the first time a teammate ran it.

    The advisory lock has to be taken on ONE dedicated client and held
    for the whole run. pg_advisory_lock is session-scoped, so taking it
    on one pooled connection and running the migration on another would
    hold nothing at all. It is released in a `finally` block before the
    client goes back to the pool — a session lock abandoned on a pooled
    connection would block every future migration run until that
    connection happened to close.

    The pool sets statement_timeout to 15 s, which is right for API
    queries and wrong for DDL: building a GiST index over real slope
    units can legitimately take longer. Each migration therefore runs
    `SET LOCAL statement_timeout = '120s'`, which lasts only until that
    transaction ends and leaves the API's limit untouched.

    A wrong claim I wrote and corrected: my own comment said the numeric
    sort stops 010 sorting before 002. With three-digit zero-padding that
    cannot happen — alphabetical and numeric order are identical. The
    real reason to sort is that readdir() returns an unspecified order.
    Fixed the comment rather than leaving a plausible-sounding but false
    justification in the file.

    An applied migration missing from the repo is a warning, not an
    error: the schema then contains changes nobody can read, which is
    worth saying out loud but is not a reason to refuse to run.

**Pending**

    V4.2 — the schema itself (002–006). Trimmed to what the 5 September
    demo needs.

---

## V4.2 — the schema ✅ 2026-09-03

**What was done**

    Five migrations, 002 to 006, and nine tables:
      002_reference.sql  district, app_user
      003_spatial.sql    slope_unit + three indexes
      004_prediction.sql forecast_run, prediction, runout_envelope, exposure
      005_alerting.sql   alert
      006_audit.sql      audit_log + an append-only trigger

    Trimmed for the prototype. Deliberately NOT built: rainfall,
    soil_moisture, tank_state, field_report, landslide_inventory. Tank
    state and rainfall arrive inside the model's JSON and are stored as
    JSONB on prediction, because nothing in the prototype queries them
    across time — a time-series table would add joins and migrations for
    no benefit. They stay in docs/ARCHITECTURE.md as design.

    The point of this step is that the project's argument stops being
    documentation and becomes 38 CHECK constraints. The ones that matter:

      forecast_run  input_cutoff_ts <= run_ts. This is the temporal
                    leakage guard. A hindcast that claims to have used
                    data from after it ran cannot be recorded at all.
      prediction    probability BETWEEN 0 AND 1; the confidence band must
                    be ordered AND must contain its own point estimate;
                    valid_to > valid_from; one row per (run, slope unit).
      prediction    risk_level is a separate NULLABLE column, not a view
                    over probability. NULL means "exposure not yet
                    computed" — exposure cannot be computed before the
                    prediction row exists, so risk_level is filled in by
                    an UPDATE in the same transaction.
      prediction    verification_status DEFAULT 'PENDING_VERIFICATION',
                    and it cannot leave that state without both a named
                    verifier and a timestamp. Nothing self-confirms.
      runout        source_citation NOT NULL *and* checked for blankness.
      exposure      a population figure requires a population_source;
                    zero is exempt, because "nobody is exposed" is a
                    finding rather than an estimate, and the AZ-1088 case
                    depends on being able to record exactly that.
      alert         status <> 'DISPATCHED' OR authorised_by IS NOT NULL.
                    The authorisation gate. Plus: authoriser and
                    timestamp must both be present or both absent, a
                    rejection must carry a reason, and an alert cannot be
                    both authorised and rejected.
      slope_unit    source NOT NULL and is_mock NOT NULL — per-row
                    provenance, so no geometry enters the table
                    anonymously. Same idea as forecast_run.is_demo_data.
                    Per-row rather than one global DEMO_MODE switch,
                    because a global flag can be turned off while mock
                    rows are still present, and then illustrative values
                    are presented as real with no banner.

    Two smaller decisions worth recording. slope_unit.geom is typed
    GEOMETRY(POLYGON, 4326), so a wrongly projected geometry is refused
    by the database rather than silently stored — V3 measured the same
    road segment as 1019.2 m in EPSG:32646 and 0.01 in 4326, with no
    error raised, so this is a real failure mode. And district.geom is
    nullable and left NULL: we have no authoritative Aizawl boundary, and
    hand-drawing an administrative boundary would be fabricating
    geographic data. The column waits for a real boundary and a citation.

**How it was tested**

    All five migrations applied cleanly (110/33/39/15/19 ms), then a
    second run reported "up to date" — 6 migrations, nothing re-applied.

    backend/src/db/schema_constraints_test.sql — 32 assertions run inside
    a transaction that ROLLBACKs at the end. Each case is a mistake a
    reasonable person would actually make.

      25 must be REJECTED, all rejected:
         cutoff after run (leakage); probability 1.5; probability 72
         (the percentage bug); inverted band 0.8..0.5; band 0.1..0.5
         around an estimate of 0.9; valid_to before valid_from;
         risk_level 'CRITICAL'; CONFIRMED with no verifier; CONFIRMED
         with a verifier but no timestamp; duplicate (run, unit); orphan
         slope_unit_id; runout with NULL citation; runout with a blank
         citation; population 120 with no source; buildings_count -1;
         DISPATCHED with no authoriser; DISPATCHED with no dispatch time;
         authoriser with no timestamp; REJECTED with no reason; blank
         slope_unit source; geometry in SRID 32646 instead of 4326;
         audit_log UPDATE; audit_log DELETE; audit_log DELETE matching
         zero rows; audit_log TRUNCATE.

      7 must be ACCEPTED, all accepted:
         risk_level NULL; population 0 with no source (the AZ-1088
         case); CONFIRMED with a named verifier and timestamp;
         probability 0.95 with risk_level LOW; a DRAFT alert with no
         authoriser (a machine may draft); DISPATCHED once a named human
         authorised it; audit_log INSERT.

    After the rollback: 0 rows in prediction, 0 slope_units, 0 app_users,
    1 district (the seeded Aizawl row). npm test -> 7 pass, 0 fail.

**What broke or was learned**

    REVOKE UPDATE, DELETE on audit_log is the textbook answer and it does
    not work here. Our application connects as the database owner, and
    PostgreSQL skips privilege checks entirely for owners and superusers,
    so the REVOKE would have been silently ineffective — we would have
    been claiming a guarantee we did not have. A trigger cannot be
    bypassed by anyone, including a superuser in psql, and it fails with
    a message that explains itself. Creating a separate unprivileged
    application role is the proper long-term fix and is deferred.

    The trigger is FOR EACH STATEMENT, not FOR EACH ROW. A row-level
    trigger only fires for rows that match, so
    `DELETE FROM audit_log WHERE id = 999999` would have succeeded
    silently when no such row existed — reporting success for an
    operation we had forbidden. Verified: the statement-level version
    refuses even a DELETE that matches nothing.

    TRUNCATE does not fire UPDATE or DELETE triggers at all. Without a
    third BEFORE TRUNCATE trigger, one statement would have emptied the
    entire audit log while the other two triggers looked like they were
    protecting it. This is the hole a determined person would find first,
    and it is now closed and tested.

    NOT NULL is not enough for a citation. An empty string satisfies NOT
    NULL perfectly, so runout_envelope.source_citation and
    slope_unit.source also check btrim(...) <> ''.

    The confidence band needed two constraints, not one. Ordered
    (lower <= upper) was obvious; "the band must contain its own point
    estimate" was not, and its absence is worse — a band of 0.1 to 0.5
    around an estimate of 0.9 looks like honest uncertainty while being
    arithmetically impossible.

    risk_level has to be nullable, which was not the original plan.
    ARCHITECTURE.md had it NOT NULL, but exposure references prediction,
    so the prediction row must exist before exposure can be computed. The
    honest resolution is NULL meaning "exposure not yet computed", filled
    in by an UPDATE inside the same transaction. A NOT NULL column would
    have forced a placeholder risk level to be written first, and a
    placeholder risk level is exactly the kind of value that survives
    into a dashboard.

    docs/ARCHITECTURE.md §19 now opens with a note saying which tables
    the prototype builds and that the migration files, not that section,
    are the source of truth. Rudra and Riya read that document; a schema
    listing tables that do not exist is an integration failure waiting to
    happen.

**Pending**

    A separate unprivileged database role, so REVOKE also applies and the
    trigger is defence in depth rather than the only defence. Deferred:
    it needs a second credential in .env for all three developers.

    No triggers or constraints yet enforce that risk_level may only be
    set once an exposure row exists. That is a cross-table rule, so a
    CHECK cannot express it; for now the transaction in the ingest
    endpoint is what guarantees it. Noted rather than built.

    V5 — load data/sample/mock_slope_units.geojson into slope_unit,
    with source and is_mock set honestly.

---
