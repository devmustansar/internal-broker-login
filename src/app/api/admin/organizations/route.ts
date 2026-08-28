import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isSuperAdmin, isAdminOrAbove, isOrgOwner, getAdminOrgIds, canAccessVaultManagement, canCreateOrganization } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/organizations
 * Super admin: returns all organizations with counts.
 * Org admin/owner: returns only their admin-level organizations.
 * Everyone else (member-only roles, resource owners, director/pm before they've
 * been granted an org role): returns only orgs they're a member of, or where
 * they own a resource/AWS resource/credential.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!canAccessVaultManagement(auth)) return forbidden();

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

    if (isAdminOrAbove(auth)) {
      const orgs = await prisma.organization.findMany({
        where: { id: { in: getAdminOrgIds(auth) } },
        orderBy: { name: "asc" },
        include: includeOpts,
      });
      return NextResponse.json(orgs);
    }

    // Everyone else: orgs they're a member of (any role), or where they own a
    // resource, AWS resource, or credential.
    const [memberships, ownedResources, ownedAwsResources, ownedCredentials] = await Promise.all([
      prisma.userOrganization.findMany({ where: { userId: auth.userId }, select: { organizationId: true } }),
      prisma.resource.findMany({ where: { ownerUserId: auth.userId }, select: { organizationId: true } }),
      prisma.awsResource.findMany({ where: { ownerUserId: auth.userId }, select: { organizationId: true } }),
      prisma.sharedCredential.findMany({ where: { ownerUserId: auth.userId }, select: { organizationId: true } }),
    ]);
    const orgIds = new Set<string>();
    for (const r of [...memberships, ...ownedResources, ...ownedAwsResources, ...ownedCredentials]) {
      if (r.organizationId) orgIds.add(r.organizationId);
    }

    const orgs = await prisma.organization.findMany({
      where: { id: { in: Array.from(orgIds) } },
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
 * Super admin, director, or pm: creates a new organization.
 * Director/pm creators are auto-enrolled as "owner" of the org they create,
 * since they hold no global admin powers otherwise — this is what scopes
 * their access down to just the org(s) they've created or are a member of.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!canCreateOrganization(auth))
      return forbidden("Only super admins, directors, or PMs can create organizations");

    const data = await req.json();
    if (!data.name) return badRequest("Missing required field: name");

    const org = await prisma.organization.create({
      data: {
        name: data.name,
        description: data.description || null,
        ...(!isSuperAdmin(auth)
          ? { users: { create: { userId: auth.userId, role: "owner" } } }
          : {}),
      },
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
      data: {
        name: data.name,
        description: data.description,
        // Only super_admin may toggle the org-wide resource visibility flag
        ...(isSuperAdmin(auth) && data.allowAdminResourceView !== undefined
          ? { allowAdminResourceView: Boolean(data.allowAdminResourceView) }
          : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}
