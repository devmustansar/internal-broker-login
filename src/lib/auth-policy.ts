import type { AuthContext } from "@/types";

// ─── Authorization Policy Helpers ─────────────────────────────────────────────
//
// Centralized authorization logic for the multi-tenant role system.
// Two axes of access:
//   1. Global role  — super_admin | admin | user | readonly
//   2. Org-scoped role — owner | admin | member (per UserOrganization)
//
// Super_admin always bypasses everything.
// Global "admin" is a legacy shortcut: treated as org-admin for all assigned orgs.
// Org-level "owner" or "admin" grants admin powers within that specific org.

/** Returns true if the user has the super_admin role (full system access). */
export function isSuperAdmin(auth: AuthContext): boolean {
  return auth.role === "super_admin";
}

/**
 * Returns true if the user has admin-level powers in *at least one* org.
 * This is true if:
 *   - They are super_admin (global)
 *   - Their global role is "admin" (legacy — treated as admin for all assigned orgs)
 *   - They hold "owner" or "admin" role in at least one org
 */
export function isAdminOrAbove(auth: AuthContext): boolean {
  if (auth.role === "super_admin" || auth.role === "admin") return true;
  const orgRoles = auth.orgRoles || {};
  return Object.values(orgRoles).some(
    (r) => r === "admin" || r === "owner"
  );
}

/**
 * Returns a Prisma `where` filter scoped to the user's organizations.
 * - Super admins: no filter (empty object → all resources)
 * - Org admins: filter by orgs where they hold admin/owner role
 * - If user has no admin orgs: returns impossible filter (no results)
 */
export function getOrgFilter(auth: AuthContext): Record<string, any> {
  if (isSuperAdmin(auth)) return {};

  const adminOrgIds = getAdminOrgIds(auth);
  if (adminOrgIds.length === 0) return { organizationId: "___none___" };
  return { organizationId: { in: adminOrgIds } };
}

/**
 * Checks if the user can manage resources in the given organization.
 * Super admins can manage any org.
 * Org owners and admins can manage their own orgs.
 * Legacy global "admin" role also counts for assigned orgs.
 */
export function canManageOrg(
  auth: AuthContext,
  organizationId: string | null | undefined
): boolean {
  if (isSuperAdmin(auth)) return true;
  if (!organizationId) return false;
  return isOrgAdmin(auth, organizationId);
}

/**
 * Check if user is an admin (or owner) of a specific org.
 * Also returns true for legacy global "admin" role if user is a member of that org.
 */
export function isOrgAdmin(auth: AuthContext, orgId: string): boolean {
  if (isSuperAdmin(auth)) return true;

  // Org-scoped role check
  const orgRole = (auth.orgRoles || {})[orgId];
  if (orgRole === "admin" || orgRole === "owner") return true;

  // Legacy: global "admin" role acts as org admin for all assigned orgs
  if (auth.role === "admin" && (auth.organizationIds || []).includes(orgId)) {
    return true;
  }

  return false;
}

/** Check if user is the owner of a specific org. */
export function isOrgOwner(auth: AuthContext, orgId: string): boolean {
  if (isSuperAdmin(auth)) return true;
  return (auth.orgRoles || {})[orgId] === "owner";
}

/**
 * Returns the list of organization IDs where the user holds admin or owner role.
 * Includes orgs from legacy global "admin" role as well.
 */
export function getAdminOrgIds(auth: AuthContext): string[] {
  if (isSuperAdmin(auth)) return []; // super_admin doesn't need filtering

  const ids = new Set<string>();

  // Org-scoped roles
  for (const [orgId, role] of Object.entries(auth.orgRoles || {})) {
    if (role === "admin" || role === "owner") {
      ids.add(orgId);
    }
  }

  // Legacy global admin → all assigned orgs
  if (auth.role === "admin") {
    for (const orgId of auth.organizationIds || []) {
      ids.add(orgId);
    }
  }

  return Array.from(ids);
}

// ─── Resource-Owner-Aware Edit Policies ───────────────────────────────────────
//
// A "Resource Owner" is a user set as Resource.ownerUserId / AwsResource.ownerUserId.
// They gain edit rights over org credentials/2FA entries that are linked to
// their owned resource, without needing org admin/owner role.

/** Can the actor edit this SharedCredential? super_admin, org admin/owner, or the credential's resource-owner. */
export function canEditCredential(
  auth: AuthContext,
  credential: { organizationId: string; ownerUserId?: string | null }
): boolean {
  if (isSuperAdmin(auth)) return true;
  if (canManageOrg(auth, credential.organizationId)) return true;
  return !!credential.ownerUserId && credential.ownerUserId === auth.userId;
}

/**
 * Can the actor edit this TwoFactorEntry? super_admin, org admin/owner,
 * the entry's own ownerId, or the owner of the linked Resource/AwsResource.
 */
export function canEditTwoFactorEntry(
  auth: AuthContext,
  entry: { organizationId: string; ownerId?: string | null },
  linkedResourceOwnerId?: string | null,
  linkedAwsResourceOwnerId?: string | null
): boolean {
  if (isSuperAdmin(auth)) return true;
  if (canManageOrg(auth, entry.organizationId)) return true;
  if (entry.ownerId && entry.ownerId === auth.userId) return true;
  if (linkedResourceOwnerId && linkedResourceOwnerId === auth.userId) return true;
  if (linkedAwsResourceOwnerId && linkedAwsResourceOwnerId === auth.userId) return true;
  return false;
}

/** Can the actor approve/reject a VaultRequest for this org / resource? */
export function canApproveVaultRequest(
  auth: AuthContext,
  request: { organizationId: string },
  linkedResourceOwnerId?: string | null,
  linkedAwsResourceOwnerId?: string | null
): boolean {
  if (isSuperAdmin(auth)) return true;
  if (canManageOrg(auth, request.organizationId)) return true;
  if (linkedResourceOwnerId && linkedResourceOwnerId === auth.userId) return true;
  if (linkedAwsResourceOwnerId && linkedAwsResourceOwnerId === auth.userId) return true;
  return false;
}

/** Can the actor create a request for this organization? Must be a member (any role). */
export function canRequestForOrg(auth: AuthContext, organizationId: string): boolean {
  if (isSuperAdmin(auth)) return true;
  return (auth.organizationIds || []).includes(organizationId);
}

/** Coarse gate for vault management surfaces: org admin/owner/global-admin OR a resource owner. */
export function canAccessVaultManagement(auth: AuthContext): boolean {
  return isAdminOrAbove(auth) || !!auth.isResourceOwner;
}
