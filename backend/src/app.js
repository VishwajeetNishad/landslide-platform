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
import { registerAuthRoutes } from './routes/auth.js';
import { registerMetaRoutes } from './routes/meta.js';
import { registerPredictionRoutes } from './routes/predictions.js';
import { registerRiskRoutes } from './routes/risk.js';
import { registerSlopeUnitRoutes } from './routes/slope_units.js';

/**
 * Schema failure par status code kaun decide karega.
 *
 * Fastify default 400 deta hai. Par 400 ka matlab hai "main request
 * SAMAJH hi nahi paaya" -- jaise JSON toota hua ho. Rudra ka body toh
 * bilkul theek JSON hai aur saare key ke naam sahi hain; galat uska
 * MATLAB hai (probability 1.5 aayi, ya confidence band ulta hai). Uske
 * liye 422 hai -- "samajh gaya, par accept nahi kar sakta".
 *
 * Ye kyun matter karta hai: docs/API_CONTRACT.md 422 promise karta hai
 * aur Riya ka error handling usi ke against likha hai. Backend 400 bheje
 * toh uska "validation error dikhao" wala branch chalega hi nahi.
 *
 * SIRF body ke liye 422. querystring aur params 400 par hi rahenge --
 * `?district=AIZAWL;DROP` galat URL hai, galat matlab nahi, aur V6 ke
 * test uske 400 par khade hain.
 */
function schemaErrorFormatter(errors, dataVar) {
  // AJV ka `instancePath` "/predictions/0/probability" jaisa hota hai.
  // Usko "predictions[0].probability" bana rahe hoon, kyunki Rudra ne
  // JSON usi shakal mein likha hai -- JSON Pointer padhkar samajhna
  // padta hai, ye seedha dikhta hai.
  const details = errors.map((e) => {
    const field = (e.instancePath || '')
      .replace(/^\//, '')
      .replace(/\/(\d+)/g, '[$1]')
      .replace(/\//g, '.');
    return field ? `${field}: ${e.message}` : e.message;
  });

  const err = new Error(
    dataVar === 'body'
      ? `The request body was understood but is not acceptable: ${details.length} problem(s). ` +
        'Nothing was written.'
      : `${dataVar} validation failed: ${details.join('; ')}`,
  );

  err.statusCode = dataVar === 'body' ? 422 : 400;
  err.details = details;
  return err;
}

export async function buildApp({ logger = true } = {}) {
  const app = Fastify({
    schemaErrorFormatter,
    // allErrors: saari galtiyaan ek baar mein batao, sirf pehli nahi.
    //
    // AJV default mein pehli galti par ruk jaata hai (fast fail). Uska
    // matlab: Rudra 12 prediction bhejta hai, teen mein probability galat
    // hai, aur usko sirf pehli dikhti hai. Woh theek karta hai, dobara
    // bhejta hai, doosri dikhti hai. Teen round trip ek kaam ke liye.
    //
    // Iska ek known risk hai -- bahut bada nested body bhejkar koi jaan
    // boojh kar hazaaron error bana sakta hai (CPU aur memory kharch).
    // Yahan body ek forecast run hai, kuch dozen prediction, size limit
    // Fastify ka default 1 MB. Is scale par risk nahi hai.
    ajv: { customOptions: { allErrors: true } },
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

  // ---------- Error handler ----------
  // Sirf ek kaam ke liye: `details` array ko response mein bhejna.
  //
  // Fastify ka default error handler sirf { statusCode, error, message }
  // bhejta hai -- error object par lagaya hua koi bhi extra field chup-chaap
  // gir jaata hai. V7 ke 422 mein asli kaam ki cheez wahi `details` hai:
  // "predictions[2].probability: must be <= 1". Uske bina Rudra ko sirf
  // "3 problem(s)" dikhta aur teen kya hain woh sirf server log mein hota,
  // jo uske paas nahi hai.
  app.setErrorHandler((err, request, reply) => {
    const status = err.statusCode ?? 500;

    // "Ye error humne KHUD banaya tha ya ye kahin se aa gira?"
    //
    // Ye farq zaruri hai. requireDatabase() jaan-boojh kar 503 phenkta hai
    // jiska message kaam ka hai -- "DATABASE_URL is not set". Uske ulta,
    // Postgres se aaya hua error ya code ka bug bhi yahan aata hai, aur
    // uske message mein aksar constraint ka naam ya table ka structure
    // hota hai, jo client ko nahi jaana chahiye.
    //
    // Pehle main sirf `status >= 500` dekh raha tha, toh 503 ka asli
    // message bhi dab gaya aur V6 ke test toot gaye. Isliye ab dekhta hoon
    // ki statusCode kisi ne SET kiya tha ya default 500 laga hai.
    const weRaisedItOnPurpose = typeof err.statusCode === 'number' && err.statusCode !== 500;

    // 500 ka message client ko nahi bhejte. Server log mein poora error,
    // response mein sirf itna.
    if (status >= 500 && !weRaisedItOnPurpose) {
      request.log.error({ err }, 'Unhandled error');
      return reply.code(status).send({
        statusCode: status,
        error: 'Internal Server Error',
        message: 'The request could not be completed. The failure has been logged.',
      });
    }

    // 503 bhi log karte hain -- dependency down hona chup-chaap nahi
    // guzarna chahiye, chahe message client ko chala jaaye.
    if (status >= 500) {
      request.log.error({ err }, 'Dependency unavailable');
    }

    // `error` field mein HTTP ka standard naam. `new Error()` ka name bas
    // "Error" hota hai, jo client ko kuch nahi batata -- toh status code se
    // naam nikaal rahe hoon.
    const STATUS_NAMES = {
      400: 'Bad Request',
      404: 'Not Found',
      422: 'Unprocessable Entity',
      503: 'Service Unavailable',
    };

    return reply.code(status).send({
      statusCode: status,
      error: err.name === 'Error' ? (STATUS_NAMES[status] ?? 'Error') : err.name,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  });

  // ---------- Routes ----------
  await registerMetaRoutes(app);
  await registerAuthRoutes(app);
  await registerSlopeUnitRoutes(app);
  await registerPredictionRoutes(app);
  await registerRiskRoutes(app);

  return app;
}