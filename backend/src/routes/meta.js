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
          'Returns 200 when the service is up. `checks.database` will be wired in V3 ' +
          'once PostGIS is running; it is reported as `not_configured` until then.',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded'] },
              version: { type: 'string' },
              uptimeSeconds: { type: 'number' },
              checks: {
                type: 'object',
                properties: {
                  api: { type: 'string' },
                  database: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      // Har dependency ka apna check. Abhi sirf api hai; V3 mein
      // database aayega. Ek jhoothа "ok" bhejne se behtar hai
      // saaf-saaf "not_configured" bolna -- yahi honesty rule
      // yahan bhi lagta hai.
      const checks = {
        api: 'ok',
        database: 'not_configured', // V3 mein PostGIS lagne ke baad badlega
      };

      return {
        status: 'ok',
        version: config.appVersion,
        uptimeSeconds: Number(process.uptime().toFixed(1)),
        checks,
      };
    },
  );
}
