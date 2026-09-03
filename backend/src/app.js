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
import { closePool, setDbLogger } from './db/pool.js';
import { registerMetaRoutes } from './routes/meta.js';

export async function buildApp({ logger = true } = {}) {
  const app = Fastify({
    // forceCloseConnections: on app.close(), also destroy sockets that are
    // sitting idle on HTTP keep-alive.
    //
    // WHY THIS IS NOT OPTIONAL. Without it, app.close() shuts the listener
    // but leaves idle keep-alive sockets open. Those open handles keep the
    // event loop alive, so the process never exits: the shutdown log lines
    // appear, everything looks correct, and the process hangs until Docker
    // gives up after 10 s and sends SIGKILL (exit code 137).
    //
    // This was a real bug found in V3.6, not a precaution. It is invisible
    // on Windows, because SIGTERM is unsupported there, so it only appeared
    // once the same code was given a real signal inside a Linux container.
    // In production that means every deploy would SIGKILL the backend --
    // and a SIGKILL mid-alert-dispatch is exactly the incomplete audit log
    // that V13 must never produce.
    forceCloseConnections: true,
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

  // ---------- Database ----------
  // Pool khud yahan CONNECT nahi karta -- `new Pool()` sirf setting
  // rakhta hai, asli connection pehli query par banta hai ("lazy").
  //
  // Ye jaan-boojh kar hai: agar buildApp() DB se connect karne ki koshish
  // karta, toh Docker band hone par app hi start na hota aur test bhi na
  // chalte. App khada hona chahiye, aur /health se BATANA chahiye ki DB
  // nahi hai. Chup-chaap mar jaana sabse bura option hai.
  setDbLogger(app.log);

  // onClose hook: app.close() par pool bhi band ho jaaye.
  //
  // Yahan lagaya, server.js mein nahi -- kyunki test bhi app.close()
  // karte hain. Server.js mein lagata toh test ke baad pool khula reh
  // jaata aur `node --test` process hang ho jaata (khula socket process
  // ko zinda rakhta hai).
  app.addHook('onClose', async () => {
    await closePool();
  });

  // ---------- Routes ----------
  await registerMetaRoutes(app);

  return app;
}