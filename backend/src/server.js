/**
 * src/server.js -- app ko lekar port par sunata hai.
 *
 * app.js se ALAG kyun rakha:
 *   app.js  -> app banata hai (test isko use karta hai, port nahi lagta)
 *   server.js -> app ko lekar .listen() karta hai (asli chalane ke liye)
 *
 * Isi wajah se test tez hai aur network par depend nahi karta.
 */

import { buildApp } from './app.js';
import { config } from './core/config.js';

const app = await buildApp();

// ---------- Graceful shutdown ----------
// KYUN zaruri: Ctrl+C dabane par ya Docker container band karne par
// Node turant mar jaata hai. Agar us waqt koi request beech mein thi,
// ya DB connection khula tha, toh woh adhoora toot jaata hai.
//
// Ye handler bolta hai: "naye request lena band karo, jo chal rahi hain
// unko poora hone do, phir connection band karke shaanti se maro."
//
// Is project mein ye zyada matter karta hai -- V13 mein alert dispatch
// hoga. Alert dispatch ke beech mein process marna = audit log adhoora
// = kisne alert bheja pata nahi chalega. Woh accept nahi kar sakte.
let shuttingDown = false;

async function shutdown(signal) {
  // Pressing Ctrl+C twice, or a supervisor sending SIGTERM followed by
  // SIGINT, would otherwise run this whole function twice and close the
  // database pool underneath itself.
  if (shuttingDown) {
    app.log.warn(`${signal} received again -- already shutting down`);
    return;
  }
  shuttingDown = true;

  app.log.info(`${signal} received -- shutting down gracefully`);

  // A hard deadline. app.close() waits for in-flight requests to finish,
  // and a genuinely stuck request would otherwise hang the process
  // forever -- which just moves the problem instead of fixing it.
  // Docker's own patience is 10 s before it sends SIGKILL, so we exit
  // first and stay in control of the outcome.
  const forceTimer = setTimeout(() => {
    app.log.error('Graceful shutdown timed out after 8s -- forcing exit');
    process.exit(1);
  }, 8_000);
  forceTimer.unref(); // this timer must not itself keep the process alive

  try {
    await app.close();
    clearTimeout(forceTimer);
    app.log.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    clearTimeout(forceTimer);
    app.log.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    // Deliberately not awaited: a signal handler cannot be awaited by
    // anyone, and marking it async only hides rejections.
    void shutdown(signal);
  });
}

// ---------- Crash hone par saaf log ----------
// Bina iske "unhandled rejection" chup-chaap gayab ho jaata hai ya
// aadha-adhoora stack trace deta hai. Ye poora likhta hai.
process.on('unhandledRejection', (err) => {
  app.log.error({ err }, 'Unhandled promise rejection -- shutting down');
  process.exit(1);
});

// ---------- Start ----------
try {
  await app.listen({ port: config.port, host: config.host });

  app.log.info(`${config.appName} v${config.appVersion}`);
  app.log.info(`API      http://${config.host}:${config.port}`);
  app.log.info(`Docs     http://${config.host}:${config.port}/docs`);
  app.log.info(`Health   http://${config.host}:${config.port}/health`);

  // Demo mode terminal par bhi saaf dikhna chahiye. Agar demo data
  // chal raha hai toh chalane wale ko pata hona chahiye -- sirf
  // frontend banner par bharosa nahi karna.
  if (config.demoMode) {
    app.log.warn('DEMO_MODE=true -- the API is returning illustrative values, not real forecasts');
  }
} catch (err) {
  app.log.error({ err }, 'Server failed to start');
  process.exit(1);
}
