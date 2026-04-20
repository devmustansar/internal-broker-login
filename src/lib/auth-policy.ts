import type { AuthContext } from "@/types";

// ─── Authorization Policy Helpers ─────────────────────────────────────────────
//
// Centralized authorization logic for the multi-tenant role system.
// Three tiers:
//   super_admin — full platform access, bypasses org filters
//   admin       — scoped to their assigned organizations
//   user        — resource-level ACL via allowedResourceKeys

/** Returns true if the user has the super_admin role (full system access). */
export function isSuperAdmin(auth: AuthContext): boolean {
  return auth.role === "super_admin";
}

/** Returns true if the user is admin or super_admin. */
export function isAdminOrAbove(auth: AuthContext): boolean {
  return auth.role === "super_admin" || auth.role === "admin";
}

/**
 * Returns a Prisma `where` filter scoped to the user's organizations.
 * - Super admins: no filter (empty object → all resources)
 * - Admins: filter by their organization IDs
 * - If admin has no orgs: returns impossible filter (no results)
 */
export function getOrgFilter(auth: AuthContext): Record<string, any> {
  if (isSuperAdmin(auth)) return {};
  const orgIds = auth.organizationIds || [];
  if (orgIds.length === 0) return { organizationId: "___none___" };
  return { organizationId: { in: orgIds } };
}

/**
 * Checks if the user can manage resources in the given organization.
 * Super admins can manage any org. Admins can only manage their assigned orgs.
 */
export function canManageOrg(
  auth: AuthContext,
  organizationId: string | null | undefined
): boolean {
  if (isSuperAdmin(auth)) return true;
  if (!organizationId) return false;
  return (auth.organizationIds || []).includes(organizationId);
}
