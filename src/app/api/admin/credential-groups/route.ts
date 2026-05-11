import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, isSuperAdmin, getOrgFilter } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/credential-groups
 * List credential groups for the admin's orgs.
 * Optionally filter by ?organizationId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const orgId = req.nextUrl.searchParams.get("organizationId");
    const orgFilter = orgId ? { organizationId: orgId } : getOrgFilter(auth);

    const groups = await prisma.credentialGroup.findMany({
      where: orgFilter,
      include: {
        _count: { select: { credentials: true, members: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        credentials: {
          include: {
            credential: {
              select: { id: true, appName: true, loginUrl: true, description: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(groups);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/admin/credential-groups
 * Create a new credential group.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    const { name, description, organizationId } = data;

    if (!name || !organizationId) {
      return badRequest("Missing required fields: name, organizationId");
    }

    const group = await prisma.credentialGroup.create({
      data: {
        name,
        description: description || null,
        organizationId,
        createdBy: auth.userId,
      },
      include: {
        _count: { select: { credentials: true, members: true } },
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
