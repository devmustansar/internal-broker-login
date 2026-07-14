import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, canManageOrg, isSuperAdmin, isOrgAdmin } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/users
 * Lists all users with their orgs (including org roles), resource keys, and per-resource AWS policies.
 * Scoped to the admin's orgs unless super_admin.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    // scope=all lets org owners/admins search every user in the system
    // (e.g. to add a brand-new member to their org), bypassing the
    // org-membership filter below that's used for the org-scoped
    // members/resource-assignment views.
    const scope = req.nextUrl.searchParams.get("scope");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        // UserOrganization join — now includes org-scoped role
        organizations: {
          include: { organization: true },
        },
        // Resource access via join table
        resourceAccess: {
          include: {
            resource: { select: { id: true, resourceKey: true, name: true } },
            awsResource: { select: { id: true, resourceKey: true, name: true } },
          },
        },
        // Per-resource AWS policy mappings
        awsPolicies: {
          include: {
            awsResource: {
              select: {
                id: true,
                resourceKey: true,
                name: true,
                availablePolicyArns: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter by org scope for non-super-admins, unless the caller explicitly
    // asked for the unfiltered system-wide list (scope=all)
    if (!isSuperAdmin(auth) && scope !== "all") {
      // Build set of org IDs where the caller has owner or admin access
      const adminOrgIds = new Set<string>();
      for (const [orgId, role] of Object.entries(auth.orgRoles || {})) {
        if (role === "admin" || role === "owner") adminOrgIds.add(orgId);
      }
      if (auth.role === "admin") {
        for (const orgId of auth.organizationIds || []) adminOrgIds.add(orgId);
      }

      const filtered = users.filter((u) =>
        u.organizations.some((o: any) => adminOrgIds.has(o.organizationId))
      );
      return NextResponse.json(filtered);
    }

    return NextResponse.json(users);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/admin/users
 * Creates a new user with optional org memberships and org-scoped roles.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    if (!data.email || !data.name || !data.role) {
      return badRequest("Missing required fields (email, name, role)");
    }

    // Only super_admin can create other super_admins
    if (data.role === "super_admin" && !isSuperAdmin(auth)) {
      return forbidden("Only super admins can create super admin users");
    }

    // Only global admins/super admins can create global admins
    if (data.role === "admin" && auth.role !== "admin" && auth.role !== "super_admin") {
      return forbidden("Only global administrators can create global admin users");
    }

    // Validate org assignments — admin can only assign their own orgs
    // Support both legacy format (organizationIds: string[]) and new format
    // (organizations: { orgId, role }[])
    const orgAssignments: { orgId: string; role: string }[] = [];

    if (Array.isArray(data.organizations)) {
      // New format: [{ orgId, role }]
      for (const o of data.organizations) {
        orgAssignments.push({ orgId: o.orgId || o.organizationId, role: o.role || "member" });
      }
    } else if (Array.isArray(data.organizationIds)) {
      // Legacy format: string[]
      for (const orgId of data.organizationIds) {
        orgAssignments.push({ orgId, role: "member" });
      }
    }

    if (!isSuperAdmin(auth)) {
      for (const { orgId } of orgAssignments) {
        if (!canManageOrg(auth, orgId)) {
          return forbidden(`You do not have access to organization ${orgId}`);
        }
      }
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        passwordHash: data.password || "password123",
        organizations: {
          create: orgAssignments.map(({ orgId, role }) => ({
            organizationId: orgId,
            role,
          })),
        },
      },
      include: {
        organizations: {
          include: { organization: true },
        },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
