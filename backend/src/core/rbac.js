/**
 * src/core/rbac.js -- Role-Based Access Control & District Scoping (Step V10).
 *
 * Core rule from ARCHITECTURE.md §20:
 * Every district-scoped route filters on app_user.assigned_districts.
 * A LOCAL/DISTRICT_ADMIN for Aizawl CANNOT read Sikkim data.
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  DISTRICT_ADMIN: 'DISTRICT_ADMIN',
  FIELD_OFFICER: 'FIELD_OFFICER',
  CITIZEN: 'CITIZEN',
};

/**
 * Fastify preHandler hook generator: requires one of the specified roles.
 */
export function requireRole(...allowedRoles) {
  return async function checkRole(request) {
    if (!request.user) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!allowedRoles.includes(request.user.role)) {
      const err = new Error(
        `Forbidden: role '${request.user.role}' does not have required permissions. Required: [${allowedRoles.join(', ')}]`,
      );
      err.statusCode = 403;
      throw err;
    }
  };
}

/**
 * Assert that the user has access to a specific district.
 *
 * - SUPER_ADMIN has access to all districts.
 * - DISTRICT_ADMIN and FIELD_OFFICER only have access to districts in their assigned_districts array.
 * - Throws 403 Forbidden on boundary violation.
 */
export function assertDistrictAccess(user, districtId) {
  if (!user) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  if (user.role === ROLES.SUPER_ADMIN) {
    return true;
  }

  const assigned = Array.isArray(user.assigned_districts) ? user.assigned_districts : [];
  if (assigned.includes('*') || assigned.includes(districtId.toLowerCase())) {
    return true;
  }

  const err = new Error(
    `Forbidden: user '${user.email}' is not assigned to district '${districtId}'. Assigned: [${assigned.join(', ')}]`,
  );
  err.statusCode = 403;
  throw err;
}
