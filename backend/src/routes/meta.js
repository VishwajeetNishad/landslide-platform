/**
 * src/routes/meta.js -- health aur service info endpoints.
 *
 * KYUN sabse pehle yahi do banaye, koi risk endpoint nahi:
 *
 * 1. /health ke bina Docker (V3) ko nahi pata chalta ki container
 *    zinda hai ya andar se mar gaya hai. Docker sirf process dekhta
 *    hai; process chal raha ho par app hang ho, toh Docker khush
 *    rehta hai. /health asli jawab deta hai.
 *
 * 2. Ye "walking skeleton" hai -- sabse chhota poora system jo end se
 *    end tak chalta hai. Pehle patli si cheez chalao, phir usme maans
 *    bharo. Ulta karne par (pehle sab likh do, phir chalao) galti
 *    dhoondhna namumkin ho jaata hai.
 */

import { config } from '../core/config.js';
import { checkDatabase } from '../db/pool.js';

// 200 aur 503, dono ka body ek hi shakal ka hai. Ek jagah likh kar dono
// mein use kar raha hoon -- warna dono copy time ke saath alag ho jaate.
const healthBodySchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    version: { type: 'string' },
    uptimeSeconds: { type: 'number' },
    checks: {
      type: 'object',
      properties: {
        api: { type: 'string' },
        // 'ok' | 'unavailable' | 'no_postgis' | 'not_configured'
        database: { type: 'string' },
        // PostGIS ka version, ya null agar connect nahi hua
        postgis: { type: ['string', 'null'] },
      },
    },
  },
};

export async function registerMetaRoutes(app) {
  // ---------- GET / ----------
  app.get(
    '/',
    {
      schema: {
        tags: ['meta'],
        summary: 'Service information',
        description:
          'Basic service metadata. `isDemoData` tells the frontend whether to show ' +
          'the DEMO DATA banner.',
        response: {
          200: {
            type: 'object',
            properties: {
              service: { type: 'string' },
              version: { type: 'string' },
              status: { type: 'string' },
              isDemoData: { type: 'boolean' },
              pilotDistrict: { type: 'string' },
              docs: { type: 'string' },
              disclaimer: { type: 'string' },
            },
          },
        },
      },
    },
    async () => ({
      service: config.appName,
      version: config.appVersion,
      status: 'running',

      // Ye ek boolean poori honesty policy ko code mein laata hai.
      // Riya isko dekh kar orange banner dikhati hai.
      isDemoData: config.demoMode,

      pilotDistrict: config.pilotDistrictId,
      docs: '/docs',

      // Disclaimer API ke andar hai, sirf README mein nahi.
      // Jo bhi is API ko chhuega, usko ye dikhega.
      disclaimer: config.demoMode
        ? 'Values returned by this API are illustrative. They are not operational forecasts.'
        : 'Predictions are model output pending human verification. Not a substitute for official warnings issued by IMD or the SDMA.',
    }),
  );

  // ---------- GET /health ----------
  app.get(
    '/health',
    {
      schema: {
        tags: ['meta'],
        summary: 'Liveness and readiness check',
        description:
          'Returns **200** only when every dependency is usable, and **503** otherwise. ' +
          '`checks.database` is one of `ok`, `unavailable`, `no_postgis`, `not_configured`. ' +
          'PostGIS is checked separately from PostgreSQL, because a running PostgreSQL ' +
          'without the PostGIS extension would pass a naive check and then fail every ' +
          'spatial query.',
        response: {
          200: healthBodySchema,
          503: healthBodySchema,
        },
      },
    },
    async (request, reply) => {
      const db = await checkDatabase();

      const checks = {
        api: 'ok',
        database: db.state,
        postgis: db.postgis ?? null,
      };

      // Ek bhi dependency kharab hai toh 'degraded' + HTTP 503.
      //
      // V2 mein ye galat tha: database 'not_configured' hone par bhi
      // status 'ok' aur HTTP 200 jaata tha. Woh apne aap mein wahi
      // jhooth tha jisse bachne ke liye ye endpoint banaya gaya tha.
      //
      // 503 kyun matter karta hai: 200 dekhkar Docker, load balancer aur
      // monitoring -- teeno maan lete hain ki sab theek hai, aur asli
      // request par API har baar fail hoti hai. "Green dashboard, dead
      // service" sabse mehnga failure mode hai.
      // checks.postgis ek VERSION STRING hai, status nahi -- isliye usko
      // healthy ke hisaab mein nahi le rahe. PostGIS gayab hone ka case
      // pehle hi checks.database === 'no_postgis' se pakda jaata hai.
      const healthy = checks.api === 'ok' && checks.database === 'ok';

      reply.code(healthy ? 200 : 503);

      return {
        status: healthy ? 'ok' : 'degraded',
        version: config.appVersion,
        uptimeSeconds: Number(process.uptime().toFixed(1)),
        checks,
      };
    },
  );
}
