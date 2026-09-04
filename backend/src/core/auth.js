/**
 * src/core/auth.js -- Authentication & JWT security (Step V10).
 *
 * Built using Node 22 native `node:crypto` (HMAC-SHA256 & scrypt).
 * Zero external packages required -- avoids supply chain risks and
 * version incompatibilities with Fastify 5.
 */

import crypto from 'node:crypto';
import { config } from './config.js';

/**
 * Base64URL helpers (RFC 7515).
 */
function base64UrlEncode(strOrBuffer) {
  const buf = Buffer.isBuffer(strOrBuffer) ? strOrBuffer : Buffer.from(strOrBuffer, 'utf8');
  return buf.toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Hash a password using scrypt with a random 16-byte salt.
 * Output format: `<salt_hex>:<derived_key_hex>`
 */
export function hashPassword(password, customSalt = null) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = customSalt ?? crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verify a plain text password against `<salt_hex>:<derived_key_hex>`.
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;

  const [salt, key] = parts;
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);

  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

/**
 * Create a signed HS256 JWT token.
 */
export function createToken(payload, { expiresIn = config.jwtExpiresInSeconds } = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(signatureInput)
    .digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Verify a signed HS256 JWT token.
 * Returns the decoded payload or throws an Error with statusCode 401.
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Authentication token is missing');
    err.statusCode = 401;
    throw err;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    const err = new Error('Malformed authentication token');
    err.statusCode = 401;
    throw err;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(signatureInput)
    .digest();
  const actualSignature = Buffer.from(encodedSignature, 'base64url');

  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, actualSignature)
  ) {
    const err = new Error('Invalid token signature');
    err.statusCode = 401;
    throw err;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    const err = new Error('Invalid token payload encoding');
    err.statusCode = 401;
    throw err;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    const err = new Error('Authentication token has expired');
    err.statusCode = 401;
    throw err;
  }

  return payload;
}

/**
 * Fastify preHandler hook: strictly requires a valid Bearer token.
 */
export async function authenticate(request) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Authorization header with Bearer token is required');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice(7).trim();
  request.user = verifyToken(token);
}

/**
 * Fastify preHandler hook: optional auth. If present, validates and sets request.user.
 */
export async function optionalAuthenticate(request) {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    request.user = null;
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Authorization header must use Bearer scheme');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice(7).trim();
  request.user = verifyToken(token);
}
