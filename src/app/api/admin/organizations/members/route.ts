import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  notFound,
} from "@/lib/api-helpers";
import { isSuperAdmin, isOrgAdmin, isOrgOwner } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/organizations/members?organizationId=xxx
 * Lists members of an organization with their org-scoped roles.
 * Accessible by org admins/owners and super_admins.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const orgId = req.nextUrl.searchParams.get("organizationId");
    if (!orgId) return badRequest("Missing required param: organizationId");

    if (!isOrgAdmin(auth, orgId)) {
      return forbidden("You do not have admin access to this organization");
    }

    const members = await prisma.userOrganization.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            allowedResourceKeys: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/admin/organizations/members
 * Adds a user to an organization with a specific role.
 * Body: { organizationId, userId, role? }
 * Org admins can add members. Only owners/super_admins can add admins.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const data = await req.json();
    const { organizationId, userId, role = "member" } = data;

    if (!organizationId || !userId) {
      return badRequest("Missing required fields (organizationId, userId)");
    }

    if (!["owner", "admin", "member"].includes(role)) {
      return badRequest('Invalid role. Must be "owner", "admin", or "member"');
    }

    // Must be admin of the target org
    if (!isOrgAdmin(auth, organizationId)) {
      return forbidden("You do not have admin access to this organization");
    }

    // Only owners (or super_admins) can assign the "owner" or "admin" role
    if ((role === "owner" || role === "admin") && !isOrgOwner(auth, organizationId)) {
      return forbidden("Only organization owners can assign admin or owner roles");
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return notFound("User not found");

    // Verify org exists
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return notFound("Organization not found");

    const membership = await prisma.userOrganization.upsert({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      update: { role },
      create: { userId, organizationId, role },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PUT /api/admin/organizations/members
 * Updates a member's org-scoped role.
 * Body: { organizationId, userId, role }
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const data = await req.json();
    const { organizationId, userId, role } = data;

    if (!organizationId || !userId || !role) {
      return badRequest("Missing required fields (organizationId, userId, role)");
    }

    if (!["owner", "admin", "member"].includes(role)) {
      return badRequest('Invalid role. Must be "owner", "admin", or "member"');
    }

    // Must be admin of the target org to change roles
    if (!isOrgAdmin(auth, organizationId)) {
      return forbidden("You do not have admin access to this organization");
    }

    // Only owners (or super_admins) can promote to "owner" or "admin"
    if ((role === "owner" || role === "admin") && !isOrgOwner(auth, organizationId)) {
      return forbidden("Only organization owners can assign admin or owner roles");
    }

    // Cannot demote yourself if you're the last owner
    if (role !== "owner" && userId === auth.userId) {
      const ownerCount = await prisma.userOrganization.count({
        where: { organizationId, role: "owner" },
      });
      const currentMembership = await prisma.userOrganization.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      });
      if (currentMembership?.role === "owner" && ownerCount <= 1) {
        return badRequest(
          "Cannot demote the last owner. Promote another member to owner first."
        );
      }
    }

    const membership = await prisma.userOrganization.update({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      data: { role },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json(membership);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/organizations/members
 * Removes a user from an organization.
 * Body: { organizationId, userId }
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const data = await req.json();
    const { organizationId, userId } = data;

    if (!organizationId || !userId) {
      return badRequest("Missing required fields (organizationId, userId)");
    }

    if (!isOrgAdmin(auth, organizationId)) {
      return forbidden("You do not have admin access to this organization");
    }

    // Cannot remove the last owner
    const membership = await prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) return notFound("Membership not found");

    if (membership.role === "owner") {
      const ownerCount = await prisma.userOrganization.count({
        where: { organizationId, role: "owner" },
      });
      if (ownerCount <= 1) {
        return badRequest(
          "Cannot remove the last owner. Promote another member to owner first."
        );
      }
    }

    await prisma.userOrganization.delete({
      where: { userId_organizationId: { userId, organizationId } },
    });

    return NextResponse.json({ message: "Member removed from organization" });
  } catch (err) {
    return serverError(err);
  }
}
