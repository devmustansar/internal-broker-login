import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isSuperAdmin, isAdminOrAbove, isOrgAdmin, isOrgOwner } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/organizations
 * Super admin: returns all organizations with counts.
 * Org admin/owner: returns only their admin-level organizations.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const includeOpts = {
      _count: { select: { resources: true, awsResources: true, users: true } },
    };

    if (isSuperAdmin(auth)) {
      const orgs = await prisma.organization.findMany({
        orderBy: { name: "asc" },
        include: includeOpts,
      });
      return NextResponse.json(orgs);
    }

    // Org admin/owner: only orgs where they hold admin or owner role
    // Also includes orgs from legacy global "admin" role
    const orgRoles = auth.orgRoles || {};
    const adminOrgIds = new Set<string>();

    for (const [orgId, role] of Object.entries(orgRoles)) {
      if (role === "admin" || role === "owner") {
        adminOrgIds.add(orgId);
      }
    }

    // Legacy: global admin role → all assigned orgs
    if (auth.role === "admin") {
      for (const orgId of auth.organizationIds || []) {
        adminOrgIds.add(orgId);
      }
    }

    const orgs = await prisma.organization.findMany({
      where: { id: { in: Array.from(adminOrgIds) } },
      orderBy: { name: "asc" },
      include: includeOpts,
    });
    return NextResponse.json(orgs);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/admin/organizations
 * Super admin only: creates a new organization.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isSuperAdmin(auth))
      return forbidden("Only super admins can create organizations");

    const data = await req.json();
    if (!data.name) return badRequest("Missing required field: name");

    const org = await prisma.organization.create({
      data: { name: data.name, description: data.description || null },
    });

    return NextResponse.json(org, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "An organization with this name already exists" },
        { status: 409 }
      );
    }
    return serverError(err);
  }
}

/**
 * PUT /api/admin/organizations
 * Org owners and super admins can update an organization.
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const data = await req.json();
    if (!data.id || !data.name)
      return badRequest("Missing required fields (id, name)");

    // Must be owner of the org or super_admin
    if (!isOrgOwner(auth, data.id)) {
      return forbidden("Only organization owners or super admins can update organizations");
    }

    const updated = await prisma.organization.update({
      where: { id: data.id },
      data: { name: data.name, description: data.description },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}
