/**
 * src/db/pool.js -- poore backend ke liye EK shared PostgreSQL pool.
 *
 * "Pool" kya hai:
 * Har request par naya database connection banana bahut mehnga hai --
 * TCP handshake + authentication + server par process. Pool pehle se
 * kuch connections khol kar rakh leta hai aur unko udhaar deta hai.
 * Request khatam, connection wapas pool mein. Isliye ek hi pool poore
 * app mein -- har file apna pool banaye toh connections ka hisaab hi
 * khatam ho jaata hai aur Postgres "too many clients" bolne lagta hai.
 *
 * `pg` (node-postgres) use kar raha hoon. Ye raw SQL chalata hai, ORM
 * nahi hai -- jaan-boojh kar. PostGIS ke functions (ST_Intersection,
 * ST_Transform, ST_AsGeoJSON) ORM ke through likhna dard hai, aur hamara
 * poora exposure ka kaam unhi par khada hai.
 */

import pg from 'pg';

import { config } from '../core/config.js';

const { Pool } = pg;

let pool = null;
let log = console;

/**
 * Fastify ka logger (pino) de do, taaki DB ke error bhi usi format mein
 * jaayein jaise baaki log. Bina iske console par alag shakal mein aate.
 */
export function setDbLogger(logger) {
  if (logger) log = logger;
}

/**
 * Pool leke aao. Pehli baar par banata hai, uske baad wahi wapas.
 *
 * DATABASE_URL na ho toh `null` deta hai -- throw NAHI karta. Wajah:
 * app ko DB ke bina bhi khada hona chahiye, taaki /health bata sake ki
 * DB nahi hai. Agar yahan crash karte, toh /health kabhi chalta hi nahi
 * aur pata hi nahi chalta ki problem kya hai.
 */
export function getPool() {
  if (config.databaseUrl === null) return null;
  if (pool !== null) return pool;

  pool = new Pool({
    connectionString: config.databaseUrl,

    // max: ek waqt mein kitne connections. Postgres ka default limit 100
    // hai, aur uspar Rudra ka Python bhi aa sakta hai -- 10 kaafi hai.
    max: 10,

    // idle connection 30 second baad chhod do
    idleTimeoutMillis: 30_000,

    // SABSE ZARURI SETTING. Iske bina, agar Postgres band ho, toh
    // pool.query() OS ke TCP timeout tak (20+ second) LATKA rehta hai.
    // Matlab /health bhi latak jaata, aur monitoring ko "down" ke bajaye
    // "no response" milta. 3 second mein saaf jawab better hai.
    connectionTimeoutMillis: 3_000,

    // Ek galat spatial query (bina GiST index ka join) poora database
    // rok sakti hai. 15 second ke baad Postgres khud usko maar dega.
    statement_timeout: 15_000,

    // Postgres ke `pg_stat_activity` mein ye naam dikhega, toh pata
    // chalega ki kaun sa connection kiska hai (Node ka ya Rudra ka).
    application_name: 'landslide-backend',

    keepAlive: true,
  });

  // YE HANDLER LAGANA COMPULSORY HAI.
  //
  // `pg` idle connection par aane wale error ko pool par 'error' event
  // se bhejta hai. Node ka rule: 'error' event ka koi sunne wala na ho
  // toh poora process CRASH ho jaata hai.
  //
  // Kab hota hai: `docker compose restart db` karo, ya DB ka network
  // toote. Bina is handler ke backend chup-chaap mar jaata -- aur woh
  // aadhi raat ko demo se pehle hoga.
  pool.on('error', (err) => {
    log.error({ err }, 'Error on an idle database client -- the pool will recover on its own');
  });

  return pool;
}

/**
 * SQL chalao. Parameters ($1, $2) hamesha alag bhejo, string mein jod kar
 * NAHI -- warna SQL injection ka darwaza khul jaata hai.
 *
 *   query('SELECT * FROM slope_unit WHERE id = $1', ['AZ-1088'])   sahi
 *   query(`SELECT * FROM slope_unit WHERE id = '${id}'`)           GALAT
 */
export async function query(text, params = []) {
  const p = getPool();
  if (p === null) throw new Error('DATABASE_URL is not set -- did you create .env?');
  return p.query(text, params);
}

/**
 * Kai queries ko ek hi transaction mein chalao -- ya sab hongi, ya koi nahi.
 *
 * KYUN ye is project mein critical hai: V13 mein alert dispatch hoga.
 * Do cheezein honi hain -- alert ka status DISPATCHED karna, aur audit
 * log mein "kisne authorise kiya" likhna. Agar pehli ho jaaye aur dusri
 * ke waqt process mar jaaye, toh ek alert bahar chala gaya jiska koi
 * authoriser record mein nahi hai. Woh accept nahi kar sakte.
 *
 * V4 ki migrations bhi isi se chalengi -- aadhi applied schema se bura
 * kuch nahi hota.
 */
export async function withTransaction(fn) {
  const p = getPool();
  if (p === null) throw new Error('DATABASE_URL is not set -- did you create .env?');

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // ROLLBACK khud fail ho sakta hai (connection tut gaya ho). Us case
    // mein ASLI error chhupana nahi hai, isliye alag se catch.
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      log.error({ err: rollbackErr }, 'ROLLBACK also failed');
    }
    throw err;
  } finally {
    // finally mein release -- warna error par connection pool mein wapas
    // nahi jaata aur pool dheere-dheere khaali ho jaata hai ("leak").
    client.release();
  }
}

/**
 * /health ke liye check. Do cheezein dekhta hai, ek nahi:
 *
 *   1. Postgres se baat ho rahi hai?
 *   2. PostGIS extension andar hai?
 *
 * Dusra check kyun zaruri: "Postgres chal raha hai par PostGIS nahi hai"
 * ek asli failure hai. Us haalat mein SELECT 1 khushi se pass ho jaayega
 * aur har spatial query fail hogi. Toh /health ka "ok" jhootha hota.
 */
export async function checkDatabase() {
  const p = getPool();
  if (p === null) {
    return { state: 'not_configured', postgis: null };
  }

  try {
    const { rows } = await p.query(
      `SELECT current_database()                                        AS db,
              (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis`,
    );

    const { db, postgis } = rows[0];
    if (!postgis) {
      log.error({ db }, 'Connected to PostgreSQL but the PostGIS extension is missing');
      return { state: 'no_postgis', postgis: null };
    }

    return { state: 'ok', database: db, postgis };
  } catch (err) {
    // Poora error SERVER ke log mein -- wahan debugging ke liye chahiye.
    log.error({ err }, 'Database health check failed');

    // Par /health ke RESPONSE mein sirf error CODE. Health endpoint
    // aksar bina login khula hota hai; usme raw Postgres error bhejna
    // andar ka structure bahar bata deta hai.
    return { state: 'unavailable', code: err.code ?? null, postgis: null };
  }
}

/**
 * Pool band karo. Graceful shutdown mein app.close() se apne aap chalta
 * hai (dekho app.js ka onClose hook).
 */
export async function closePool() {
  if (pool === null) return;
  const p = pool;
  pool = null; // pehle null, taaki band karte waqt koi naya use na kar le
  await p.end();
  log.info('Database pool closed');
}
