/**
 * src/core/config.js -- saari settings ek jagah, ek baar.
 *
 * KYUN ye file:
 * Password ya URL ko seedha code mein likhna do tarah se galat hai --
 *   (1) Git mein push ho jaata hai (V1 mein humne .env block kiya tha)
 *   (2) laptop aur server par alag value chahiye hoti hai, toh code
 *       badalna padta hai
 *
 * Node 22 mein `--env-file=../.env` flag built-in hai, isliye `dotenv`
 * package ki zarurat nahi -- ek dependency kam.
 */

/**
 * Environment variable ko boolean bana kar do.
 *
 * KYUN alag function: process.env se sab kuch STRING aata hai.
 * String "false" JavaScript mein TRUTHY hai -- toh
 * `if (process.env.DEMO_MODE)` "false" par bhi TRUE nikalta hai.
 * Ye ek classic bug hai. Yahan hum saaf-saaf compare karte hain.
 */
function toBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export const config = {
  // ---------- App ----------
  appName: 'Landslide Early Warning & Monitoring Platform',
  appVersion: '0.2.0',
  appEnv: process.env.APP_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  port: Number(process.env.PORT ?? 8000),
  host: process.env.HOST ?? '127.0.0.1',

  // ---------- Honesty flag ----------
  // DEMO_MODE=true  -> API har response mein isDemoData: true bhejta hai
  //                 -> frontend orange "DEMO DATA" banner dikhata hai
  //
  // Ye ek boolean poori honesty policy ko CODE mein laata hai, sirf
  // documentation mein nahi. Asli data aayega toh ye false hoga aur
  // banner khud gayab ho jaayega -- Riya ko kuch badalna nahi padega.
  //
  // Default TRUE hai -- "safe default". Koi .env set karna bhool jaaye
  // toh bhi galat side par nahi girega. Bhoolne ki saza "demo data
  // ko real bolkar present kar dena" nahi honi chahiye.
  demoMode: toBool(process.env.DEMO_MODE, true),

  // ---------- Database ----------
  // Yahan koi fallback URL JAAN-BOOJH KAR nahi hai. Pehle
  // 'postgresql://landslide:change_me_locally@localhost:5432/landslide'
  // likha hua tha. Do wajah se hataya:
  //
  //   1. Source code mein ek fake credential pada rehta tha. Kisi din
  //      woh kisi ki asli password ban jaata.
  //   2. Fallback hone se `databaseUrl` KABHI khaali nahi hota, toh
  //      /health "not_configured" bol hi nahi sakta tha -- woh state
  //      pahunch se bahar thi. Ab null aata hai aur /health sach bolta hai.
  //
  // DATABASE_URL `.env` se aata hai (`npm run dev` usko --env-file se
  // padhta hai). Test `--env-file` ke bina chalte hain, isliye unme ye
  // null rehta hai -- aur wahi test karta hai ki DB na hone par API
  // jhootha "ok" nahi bolti.
  databaseUrl: process.env.DATABASE_URL ?? null,

  // ---------- Pilot region ----------
  pilotDistrictId: process.env.PILOT_DISTRICT_ID ?? 'aizawl',

  // ---------- CRS rule (docs/ARCHITECTURE.md) ----------
  // CRS = Coordinate Reference System. Zameen ke point ko number mein
  // likhne ka tareeka.
  //
  //   4326  = WGS84, DEGREES mein (lat/lon). Storage, API, web map.
  //           >>> ISME AREA YA DISTANCE KABHI NAHI NAAPNA <<<
  //           1 degree Aizawl mein ~102 km hai, Kanyakumari mein ~110 km.
  //           Degrees mein area nikaalne se "square degrees" milta hai,
  //           jo koi cheez nahi hai.
  //
  //   32646 = UTM Zone 46N, METRES mein. Mizoram/Manipur/Nagaland/
  //           Meghalaya/Assam ka metric kaam.
  //   32645 = UTM Zone 45N -- Sikkim.
  //
  // Rule: slope/area/length/buffer/runout ke liye UTM mein badlo,
  // wapas 4326 mein store karo.
  storageSrid: 4326,
  metricSrid: 32646,
};
