/**
 * src/routes/auth.js -- Authentication routes (Step V10).
 *
 *   POST /api/v1/auth/login -> returns signed JWT and user info
 *   GET  /api/v1/auth/me    -> returns authenticated user details
 */

import { authenticate, createToken, verifyPassword } from '../core/auth.js';
import { config } from '../core/config.js';
import { getPool, query } from '../db/pool.js';

function requireDatabase() {
  if (getPool() === null) {
    const err = new Error(
      'The database is not configured, so authentication cannot be performed. ' +
        'Set DATABASE_URL and run: npm run migrate',
    );
    err.statusCode = 503;
    throw err;
  }
}

export async function registerAuthRoutes(app) {
  // ---------- POST /api/v1/auth/login ----------
  app.post(
    '/api/v1/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Log in with email and password to receive a JWT',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              token_type: { type: 'string', enum: ['Bearer'] },
              expires_in: { type: 'integer' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  email: { type: 'string' },
                  full_name: { type: 'string' },
                  role: { type: 'string' },
                  assigned_districts: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      requireDatabase();
      const { email, password } = request.body;

      const { rows } = await query(
        `SELECT id, email, full_name, role, assigned_districts, password_hash, is_active
         FROM app_user
         WHERE lower(email) = lower($1)`,
        [email],
      );

      if (rows.length === 0) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
      }

      const user = rows[0];
      if (!user.is_active) {
        const err = new Error('User account is inactive');
        err.statusCode = 401;
        throw err;
      }

      const valid = verifyPassword(password, user.password_hash);
      if (!valid) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
      }

      const payload = {
        sub: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        assigned_districts: user.assigned_districts ?? [],
      };

      const token = createToken(payload);

      return {
        token,
        token_type: 'Bearer',
        expires_in: config.jwtExpiresInSeconds,
        user: {
          id: Number(user.id),
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          assigned_districts: user.assigned_districts ?? [],
        },
      };
    },
  );

  // ---------- GET /api/v1/auth/me ----------
  app.get(
    '/api/v1/auth/me',
    {
      preHandler: authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Get details of the currently authenticated user',
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  sub: { type: 'integer' },
                  email: { type: 'string' },
                  full_name: { type: 'string' },
                  role: { type: 'string' },
                  assigned_districts: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                additionalProperties: true,
              },
            },
          },
        },
      },
    },
    async (request) => {
      return { user: request.user };
    },
  );
}
