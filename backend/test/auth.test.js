/**
 * test/auth.test.js -- Authentication, JWT security, and RBAC district scoping.
 *
 * Implements verification for Step V10:
 * 1. Unit tests for JWT creation, verification, signature tampering, expiration.
 * 2. Password hashing & constant-time comparison.
 * 3. RBAC permission & district boundary isolation.
 * 4. Crucial Negative Test: Aizawl Admin cannot read Sikkim data -> 403 Forbidden.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { createToken, hashPassword, verifyPassword, verifyToken } from '../src/core/auth.js';
import { assertDistrictAccess, ROLES } from '../src/core/rbac.js';

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe('Auth & RBAC unit tests (no database required)', () => {
  test('createToken generates a valid 3-part base64url JWT', () => {
    const token = createToken({ sub: 101, email: 'officer@example.gov.in', role: 'DISTRICT_ADMIN' });
    assert.equal(typeof token, 'string');
    const parts = token.split('.');
    assert.equal(parts.length, 3, 'JWT must contain header, payload, signature');
  });

  test('verifyToken successfully unpacks payload claims', () => {
    const claims = { sub: 101, email: 'officer@example.gov.in', role: 'DISTRICT_ADMIN', assigned_districts: ['aizawl'] };
    const token = createToken(claims);
    const decoded = verifyToken(token);

    assert.equal(decoded.sub, claims.sub);
    assert.equal(decoded.email, claims.email);
    assert.equal(decoded.role, claims.role);
    assert.deepEqual(decoded.assigned_districts, claims.assigned_districts);
    assert.ok(decoded.iat, 'iat claim must exist');
    assert.ok(decoded.exp, 'exp claim must exist');
    assert.ok(decoded.exp > decoded.iat, 'exp must be after iat');
  });

  test('verifyToken rejects a malformed token with 401', () => {
    assert.throws(
      () => verifyToken('not.a.valid.jwt.token'),
      (err) => err.statusCode === 401 && err.message.includes('Malformed'),
    );
  });

  test('verifyToken rejects a tampered token payload with 401', () => {
    const token = createToken({ sub: 101, role: 'CITIZEN' });
    const parts = token.split('.');
    // Tamper with the payload (second part)
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 101, role: 'SUPER_ADMIN' })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.throws(
      () => verifyToken(tamperedToken),
      (err) => err.statusCode === 401 && err.message.includes('signature'),
    );
  });

  test('verifyToken rejects an expired token with 401', () => {
    // Issue token with -10 seconds lifetime
    const token = createToken({ sub: 101 }, { expiresIn: -10 });
    assert.throws(
      () => verifyToken(token),
      (err) => err.statusCode === 401 && err.message.includes('expired'),
    );
  });

  test('password hashing and verification verify correctly', () => {
    const pass = 'correctHorseBatteryStaple';
    const hash = hashPassword(pass);
    assert.ok(hash.includes(':'), 'Hash must be in salt:derived_key format');
    assert.equal(verifyPassword(pass, hash), true);
    assert.equal(verifyPassword('wrongPassword', hash), false);
  });

  describe('RBAC district scoping assertions', () => {
    const aizawlAdmin = {
      email: 'admin.aizawl@disaster.mz.gov.in',
      role: ROLES.DISTRICT_ADMIN,
      assigned_districts: ['aizawl'],
    };

    const superAdmin = {
      email: 'superadmin@ndma.gov.in',
      role: ROLES.SUPER_ADMIN,
      assigned_districts: ['*'],
    };

    test('Aizawl admin is granted access to Aizawl', () => {
      assert.equal(assertDistrictAccess(aizawlAdmin, 'aizawl'), true);
      assert.equal(assertDistrictAccess(aizawlAdmin, 'AIZAWL'), true);
    });

    test('NEGATIVE TEST: Aizawl admin is BLOCKED from Sikkim/Gangtok with 403', () => {
      assert.throws(
        () => assertDistrictAccess(aizawlAdmin, 'gangtok'),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /Forbidden.*not assigned to district 'gangtok'/);
          return true;
        },
      );
    });

    test('SUPER_ADMIN is granted access to any district', () => {
      assert.equal(assertDistrictAccess(superAdmin, 'aizawl'), true);
      assert.equal(assertDistrictAccess(superAdmin, 'gangtok'), true);
      assert.equal(assertDistrictAccess(superAdmin, 'champhai'), true);
    });
  });
});

describe('Auth & RBAC endpoints (database backed)', {
  skip: !HAS_DB && 'DATABASE_URL is not set -- run npm run test:db',
}, () => {
  let app;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('POST /api/v1/auth/login with valid credentials returns 200 and JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin.aizawl@disaster.mz.gov.in',
        password: 'prototype2026!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.token, 'Must return token');
    assert.equal(body.token_type, 'Bearer');
    assert.equal(body.user.email, 'admin.aizawl@disaster.mz.gov.in');
    assert.equal(body.user.role, 'DISTRICT_ADMIN');
    assert.deepEqual(body.user.assigned_districts, ['aizawl']);
  });

  test('POST /api/v1/auth/login with incorrect password returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin.aizawl@disaster.mz.gov.in',
        password: 'incorrectPassword123',
      },
    });

    assert.equal(res.statusCode, 401);
    assert.match(res.json().message, /Invalid email or password/);
  });

  test('GET /api/v1/auth/me without token returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    assert.equal(res.statusCode, 401);
  });

  test('GET /api/v1/auth/me with valid Bearer token returns current user', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin.aizawl@disaster.mz.gov.in',
        password: 'prototype2026!',
      },
    });
    const token = loginRes.json().token;

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(meRes.statusCode, 200);
    const meBody = meRes.json();
    assert.equal(meBody.user.email, 'admin.aizawl@disaster.mz.gov.in');
    assert.equal(meBody.user.role, 'DISTRICT_ADMIN');
  });

  test('CRUCIAL NEGATIVE TEST: Aizawl admin querying Gangtok/Sikkim risk receives 403 Forbidden', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin.aizawl@disaster.mz.gov.in',
        password: 'prototype2026!',
      },
    });
    const aizawlToken = loginRes.json().token;

    // Attempt to access gangtok data with aizawl admin token
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/risk/current?district=gangtok',
      headers: {
        authorization: `Bearer ${aizawlToken}`,
      },
    });

    assert.equal(res.statusCode, 403, 'Aizawl admin must be forbidden from viewing gangtok data');
    assert.match(res.json().message, /Forbidden.*not assigned to district 'gangtok'/);
  });

  test('Aizawl admin querying Aizawl risk receives 200 OK', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin.aizawl@disaster.mz.gov.in',
        password: 'prototype2026!',
      },
    });
    const aizawlToken = loginRes.json().token;

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/risk/current?district=aizawl',
      headers: {
        authorization: `Bearer ${aizawlToken}`,
      },
    });

    assert.equal(res.statusCode, 200);
  });

  test('Super admin querying Gangtok risk receives 200 OK', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'superadmin@ndma.gov.in',
        password: 'prototype2026!',
      },
    });
    const superToken = loginRes.json().token;

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/risk/current?district=gangtok',
      headers: {
        authorization: `Bearer ${superToken}`,
      },
    });

    // Gangtok exists in district table, returns 200 (empty features since no runs yet)
    assert.equal(res.statusCode, 200);
  });
});
