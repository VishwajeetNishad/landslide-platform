/**
 * src/app.js -- Fastify app banata hai, par CHALATA nahi.
 *
 * KYUN "banata hai par chalata nahi" (ye pattern sabse zaruri hai):
 *
 * Agar app banane aur port par sunne ka kaam ek hi file mein hota, toh
 * test likhne ke liye pehle asli server start karna padta, port 8000
 * khaali hona padta, aur test ke baad band karna padta. Slow aur flaky.
 *
 * Yahan buildApp() bas app OBJECT deta hai. Test usko seedha
 * app.inject() se call karta hai -- koi network nahi, koi port nahi,
 * millisecond mein chalta hai. server.js alag file hai jo isko lekar
 * .listen() karta hai.
 *
 * Isko "app factory pattern" kehte hain.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config } from './core/config.js';
import { registerMetaRoutes } from './routes/meta.js';

export async function buildApp({ logger = true } = {}) {
  const app = Fastify({
    // logger: har request apne aap log hoti hai -- request id, method,
    // path, status, aur kitne millisecond lage. Ye debugging mein
    // console.log se bahut behtar hai.
    logger:
      logger === false
        ? false
        : {
            level: config.logLevel,
            // development mein rangeen padhne-layak output, production
            // mein raw JSON (jisko log system parse kar sake)
            transport:
              config.appEnv === 'development'
                ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
                : undefined,
          },
  });

  // ---------- CORS ----------
  // CORS = Cross-Origin Resource Sharing.
  //
  // Browser ka default rule: localhost:5173 (Riya ka React) par chal
  // rahi website localhost:8000 (mera API) se data NAHI maang sakti --
  // kyunki port alag hai, toh browser inko "do alag website" maanta hai.
  // Ye rule tumhari bank ki website ko kisi random site se bachata hai.
  //
  // Bina iske Riya ko browser console mein ye dikhta:
  //   "Access to fetch at 'http://localhost:8000' from origin
  //    'http://localhost:5173' has been blocked by CORS policy"
  //
  // Ye #1 cheez hai jispar frontend-backend integration atakta hai.
  // Isliye pehle din se laga raha hoon.
  await app.register(cors, {
    origin:
      config.appEnv === 'development'
        ? true // dev mein sab allowed -- Riya ka port kuch bhi ho
        : ['https://landslide-ner.example'], // production mein sirf apni site
    credentials: true,
  });

  // ---------- OpenAPI spec ----------
  // OpenAPI = API ka machine-readable description. "Kaun endpoint hai,
  // kya bhejo, kya wapas milega" -- sab ek JSON mein.
  //
  // Fayda: Riya ko API test karne ke liye mujhse poochhna nahi padega.
  // Woh browser mein /docs khol ke button daba kar khud dekh legi.
  // Ye "self-documenting API" hai.
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: config.appName,
        version: config.appVersion,
        description:
          'Landslide early-warning, verification, risk assessment and response API. ' +
          'Pilot district: Aizawl, Mizoram.\n\n' +
          '**Values returned by this API in demo mode are illustrative. ' +
          'They are not operational forecasts.**\n\n' +
          'Three fields are deliberately separate and must never be conflated:\n' +
          '- `probability` is set by the model\n' +
          '- `riskLevel` is probability combined with exposure\n' +
          '- `verificationStatus` is set by a human officer',
      },
      servers: [{ url: `http://${config.host}:${config.port}`, description: 'Local development' }],
      tags: [
        { name: 'meta', description: 'Health and service information' },
        { name: 'slope-units', description: 'Slope unit registry (V6)' },
        { name: 'predictions', description: 'Model output ingest and retrieval (V7)' },
        { name: 'risk', description: 'Risk assessment for the dashboard (V9)' },
      ],
    },
  });

  // Swagger UI = us OpenAPI JSON ko sundar clickable page bana deta hai
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  // ---------- Routes ----------
  await registerMetaRoutes(app);

  return app;
}
