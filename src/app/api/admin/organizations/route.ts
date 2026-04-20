import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isSuperAdmin, isAdminOrAbove } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/organizations
 * Super admin: returns all organizations with counts.
 * Admin: returns only their assigned organizations.
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

    // Admin: only their orgs
    const orgs = await prisma.organization.findMany({
      where: { users: { some: { userId: auth.userId } } },
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
 * Super admin only: updates an organization.
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isSuperAdmin(auth))
      return forbidden("Only super admins can update organizations");

    const data = await req.json();
    if (!data.id || !data.name)
      return badRequest("Missing required fields (id, name)");

    const updated = await prisma.organization.update({
      where: { id: data.id },
      data: { name: data.name, description: data.description },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}
