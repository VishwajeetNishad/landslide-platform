/**
 * test/meta.test.js -- pehla test.
 *
 * Node 22 ka BUILT-IN test runner use kar raha hoon (`node --test`).
 * Jest ya Vitest install karne ki zarurat nahi -- ek dependency kam,
 * aur ek cheez kam jo Riya/Rudra ke laptop par toot sake.
 *
 * Dhyaan do: yahan koi server START nahi ho raha, koi port nahi lag
 * raha, koi fetch() nahi hai. app.inject() request ko SEEDHA app ke
 * andar daal deta hai. Isliye ye millisecond mein chalta hai aur kabhi
 * "port already in use" nahi deta.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';

describe('meta routes', () => {
  let app;

  before(async () => {
    // logger: false -- test output saaf rakhne ke liye
    app = await buildApp({ logger: false });
    await app.ready(); // saare plugins load hone do
  });

  after(async () => {
    await app.close();
  });

  test('GET /health shape sahi deta hai', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    // 200 ya 503 -- dono valid hain. 503 ka matlab "API zinda hai par
    // koi dependency kharab hai". Isliye statusCode par nahi, SHAPE par
    // assert kar rahe hain.
    assert.ok([200, 503].includes(res.statusCode), `200 ya 503 chahiye, mila ${res.statusCode}`);

    const body = res.json();
    assert.equal(typeof body.version, 'string');
    assert.equal(typeof body.uptimeSeconds, 'number');
    assert.equal(body.checks.api, 'ok');
  });

  test('GET /health database ka state ek jaana-pehchana value hai', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json();

    assert.ok('database' in body.checks, 'health mein database check hona chahiye');
    assert.ok(
      ['ok', 'unavailable', 'no_postgis', 'not_configured'].includes(body.checks.database),
      `database state anjaan hai: ${body.checks.database}`,
    );

    // Test `--env-file` ke BINA chalte hain (dekho package.json), toh
    // DATABASE_URL undefined hai aur normally yahan 'not_configured'
    // aayega. Par exact value par assert nahi kar rahe -- warna jo
    // banda .env load karke test chalaye uska test bina wajah tootega.
  });

  test('GET /health kabhi jhootha ok nahi bolta', async () => {
    // YE IS FILE KA SABSE ZARURI TEST HAI.
    //
    // V2 mein bug tha: database 'not_configured' hote hue bhi status
    // 'ok' aur HTTP 200 jaata tha. Wahi jhooth tha jisse bachne ke liye
    // ye endpoint banaya gaya tha.
    //
    // "Green dashboard, dead service" sabse mehnga failure mode hai --
    // Docker khush, monitoring khush, aur asli request har baar fail.
    // Ye test us invariant ko pakad kar rakhta hai:
    //
    //   sab dependency ok  <=>  status 'ok'  aur  HTTP 200
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json();

    const everythingOk = body.checks.api === 'ok' && body.checks.database === 'ok';

    if (everythingOk) {
      assert.equal(body.status, 'ok');
      assert.equal(res.statusCode, 200);
    } else {
      assert.equal(body.status, 'degraded', 'dependency kharab hai toh status degraded hona chahiye');
      assert.equal(res.statusCode, 503, 'dependency kharab hai toh HTTP 503 hona chahiye, 200 nahi');
    }
  });

  test('GET / service info aur isDemoData flag deta hai', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });

    assert.equal(res.statusCode, 200);

    const body = res.json();
    assert.equal(typeof body.service, 'string');
    assert.equal(body.status, 'running');
    assert.equal(body.pilotDistrict, 'aizawl');

    // isDemoData BOOLEAN hona chahiye, string nahi.
    //
    // KYUN ye test asli hai: .env se sab STRING aata hai, aur string
    // "false" JavaScript mein TRUTHY hai. Agar hum sidha
    // process.env.DEMO_MODE pass kar dete, toh DEMO_MODE=false likhne
    // par bhi demo mode ON reh jaata. Iska matlab hota: demo data ko
    // real forecast bolkar dikha dena. Ye test woh bug pakadta hai.
    assert.equal(typeof body.isDemoData, 'boolean', 'isDemoData boolean hona chahiye, string nahi');
  });

  test('demo mode par API khud disclaimer bhejta hai', async () => {
    // KYUN: honesty rule sirf README mein nahi honi chahiye. Jo bhi
    // is API ko chhuega -- Riya, judge, ya koi aur -- usko response
    // ke ANDAR dikhna chahiye ki ye values illustrative hain.
    const res = await app.inject({ method: 'GET', url: '/' });
    const body = res.json();

    assert.equal(typeof body.disclaimer, 'string');
    assert.ok(body.disclaimer.length > 0, 'disclaimer khaali nahi hona chahiye');

    if (body.isDemoData) {
      assert.match(
        body.disclaimer,
        /illustrative/i,
        'demo mode mein disclaimer "illustrative" bolna chahiye',
      );
      assert.match(
        body.disclaimer,
        /not operational forecasts/i,
        'demo mode mein disclaimer saaf bolna chahiye ki ye operational forecast nahi hai',
      );
    }
  });

  test('OpenAPI spec bana aur usme honesty rule likha hai', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });

    assert.equal(res.statusCode, 200);

    const spec = res.json();
    assert.equal(spec.openapi, '3.1.0');
    assert.ok(spec.paths['/health'], 'spec mein /health hona chahiye');

    // Teen field ka farak API documentation mein likha hona chahiye,
    // taaki koi bhi is API ko use kare toh usko pehle din pata chale.
    assert.match(spec.info.description, /probability/i);
    assert.match(spec.info.description, /riskLevel/i);
    assert.match(spec.info.description, /verificationStatus/i);
  });

  test('anjaan route par 404 aata hai, crash nahi hota', async () => {
    const res = await app.inject({ method: 'GET', url: '/koi-aisa-route-nahi-hai' });
    assert.equal(res.statusCode, 404);
  });
});
