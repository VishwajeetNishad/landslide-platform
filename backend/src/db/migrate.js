/**
 * src/db/migrate.js -- applies the numbered SQL files in src/db/migrations/.
 *
 * Run it with:  npm run migrate
 *
 * WHY PLAIN SQL FILES AND NOT AN ORM MIGRATION TOOL
 *
 * Our schema is mostly PostGIS types (GEOMETRY(POLYGON, 4326)), GiST
 * indexes, CHECK constraints and a trigger. Those are the parts that carry
 * the project's guarantees, and every ORM expresses them badly or not at
 * all. Numbered .sql files are the schema itself -- what you read is
 * exactly what the database gets.
 *
 * WHAT THIS RUNNER GUARANTEES
 *
 *   1. Order        -- files run in numeric order. Two things give us that:
 *                      the three-digit zero-padded names (so 010 cannot
 *                      sort before 002, as "10_" would), and an explicit
 *                      sort, because readdir() promises no order at all.
 *   2. Once only    -- an applied migration is recorded and never re-run.
 *   3. All or none  -- each migration runs inside a transaction. Postgres
 *                      makes DDL transactional, so a migration that fails
 *                      halfway leaves NOTHING behind. A half-applied
 *                      schema is the worst state to debug at 2 a.m.
 *   4. Not edited   -- the checksum of every applied file is stored. Edit
 *                      an applied migration and the next run refuses to
 *                      continue, because your database and your repo have
 *                      silently stopped matching.
 *   5. One at a time -- a Postgres advisory lock, so two people running
 *                      `npm run migrate` at once cannot both apply 007.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closePool, getPool } from './pool.js';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

// Filenames must look like 003_spatial.sql -- three digits, underscore,
// lowercase name. Enforced rather than assumed, because "3_spatial.sql"
// would sort and number differently and the mistake would only surface on
// someone else's machine.
const FILENAME_PATTERN = /^(\d{3})_[a-z0-9_]+\.sql$/;

// An arbitrary but FIXED number. Two processes asking for the same
// advisory lock key means the second one waits. Any constant works as long
// as it never changes; it is not stored anywhere.
const LOCK_KEY = 4062024001n;

/**
 * Hash the file contents so we can tell later whether the file changed.
 *
 * The \r\n -> \n normalisation is not cosmetic. Git on Windows can check
 * the same file out with CRLF line endings where Linux gets LF. Without
 * normalising, the identical migration would hash differently on the two
 * machines and this runner would wrongly report that it had been edited.
 */
function checksum(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** Read migrations/, validate the names, return them in numeric order. */
async function loadMigrations() {
  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Migrations folder not found: ${MIGRATIONS_DIR}`);
    }
    throw err;
  }

  const sqlFiles = entries.filter((name) => name.endsWith('.sql'));

  const bad = sqlFiles.filter((name) => !FILENAME_PATTERN.test(name));
  if (bad.length > 0) {
    throw new Error(
      `Badly named migration file(s): ${bad.join(', ')}\n` +
        'Expected the form 003_spatial.sql -- three digits, underscore, lowercase name.',
    );
  }

  const migrations = sqlFiles.map((name) => ({
    version: name.match(FILENAME_PATTERN)[1],
    filename: name,
  }));

  // Two files with the same number would make "applied" ambiguous.
  const seen = new Map();
  for (const m of migrations) {
    if (seen.has(m.version)) {
      throw new Error(`Duplicate migration number ${m.version}: ${seen.get(m.version)} and ${m.filename}`);
    }
    seen.set(m.version, m.filename);
  }

  migrations.sort((a, b) => Number(a.version) - Number(b.version));

  for (const m of migrations) {
    m.sql = await readFile(path.join(MIGRATIONS_DIR, m.filename), 'utf8');
    m.checksum = checksum(m.sql);
  }

  return migrations;
}

/**
 * Create the bookkeeping table.
 *
 * This one cannot itself be a migration -- we would have to read the table
 * to know whether to create the table. So it is created directly, and
 * IF NOT EXISTS keeps that safe to repeat.
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT        PRIMARY KEY,
      filename   TEXT        NOT NULL,
      checksum   TEXT        NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function main() {
  const pool = getPool();
  if (pool === null) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    process.exitCode = 1;
    return;
  }

  const migrations = await loadMigrations();

  // One dedicated client for the whole run. The advisory lock is held by a
  // SESSION, so it has to be the same connection throughout -- taking the
  // lock on one pooled client and the migration on another would hold
  // nothing at all.
  const client = await pool.connect();
  let lockHeld = false;

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY.toString()]);
    lockHeld = true;

    await ensureMigrationsTable(client);

    const { rows: appliedRows } = await client.query(
      'SELECT version, filename, checksum FROM schema_migrations ORDER BY version',
    );
    const applied = new Map(appliedRows.map((r) => [r.version, r]));

    // Verify every already-applied file BEFORE applying anything new. If
    // the repo and the database have diverged, stop while the database is
    // still in a state we understand.
    for (const m of migrations) {
      const record = applied.get(m.version);
      if (record && record.checksum !== m.checksum) {
        throw new Error(
          `Migration ${m.filename} has changed since it was applied.\n` +
            `  in the database: ${record.checksum.slice(0, 12)}...\n` +
            `  on disk:         ${m.checksum.slice(0, 12)}...\n` +
            'Never edit an applied migration -- add a new numbered file instead.\n' +
            'While the schema is still disposable you may instead reset it:\n' +
            '  docker compose down -v && docker compose up -d && npm run migrate',
        );
      }
    }

    // A migration recorded in the database but missing from the repo means
    // someone deleted a file. The schema then contains changes nobody can
    // read, which is worth a warning even though it is not fatal.
    for (const version of applied.keys()) {
      if (!migrations.some((m) => m.version === version)) {
        console.warn(`WARNING: migration ${applied.get(version).filename} is recorded as applied but is missing from the repo.`);
      }
    }

    const pending = migrations.filter((m) => !applied.has(m.version));

    if (pending.length === 0) {
      console.log(`Schema is up to date -- ${applied.size} migration(s) already applied, nothing to do.`);
      return;
    }

    console.log(`${pending.length} pending migration(s):`);
    for (const m of pending) console.log(`  ${m.filename}`);

    for (const m of pending) {
      const startedAt = process.hrtime.bigint();
      try {
        await client.query('BEGIN');

        // The pool sets statement_timeout to 15 s, which is right for API
        // queries and wrong here -- building a GiST index over real slope
        // units can legitimately take longer. SET LOCAL lasts only until
        // this transaction ends, so the API's limit is untouched.
        await client.query("SET LOCAL statement_timeout = '120s'");

        await client.query(m.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
          [m.version, m.filename, m.checksum],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        // Deliberately re-thrown rather than continuing to the next file.
        // Applying 006 on top of a failed 005 would produce a schema that
        // matches no migration history at all.
        throw new Error(`Migration ${m.filename} failed and was rolled back: ${err.message}`);
      }
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      console.log(`  applied ${m.filename} in ${ms.toFixed(0)} ms`);
    }

    console.log(`Done -- ${pending.length} migration(s) applied.`);
  } finally {
    // Release before returning the client to the pool. A session-level
    // advisory lock left behind on a pooled connection would block every
    // future migration run until that connection happens to close.
    if (lockHeld) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY.toString()]);
      } catch (err) {
        console.error(`Could not release the advisory lock: ${err.message}`);
      }
    }
    client.release();
    await closePool();
  }
}

try {
  await main();
} catch (err) {
  console.error(`\nMIGRATION FAILED\n${err.message}`);
  await closePool();
  process.exitCode = 1;
}
