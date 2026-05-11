import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, isSuperAdmin, canManageOrg } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/credential-groups/[id]/credentials
 * Add a credential to a group.
 * Body: { credentialId: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id: groupId } = await params;
    const { credentialId } = await req.json();
    if (!credentialId) return badRequest("credentialId is required");

    const group = await prisma.credentialGroup.findUnique({ where: { id: groupId } });
    if (!group) return notFound("Group not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, group.organizationId)) {
      return forbidden();
    }

    const entry = await prisma.credentialGroupEntry.upsert({
      where: { credentialId_groupId: { credentialId, groupId } },
      create: { credentialId, groupId },
      update: {},
      include: {
        credential: {
          select: { id: true, appName: true, loginUrl: true, description: true },
        },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/credential-groups/[id]/credentials
 * Remove a credential from a group.
 * Body: { credentialId: string }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id: groupId } = await params;
    const { credentialId } = await req.json();
    if (!credentialId) return badRequest("credentialId is required");

    const group = await prisma.credentialGroup.findUnique({ where: { id: groupId } });
    if (!group) return notFound("Group not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, group.organizationId)) {
      return forbidden();
    }

    await prisma.credentialGroupEntry.deleteMany({
      where: { credentialId, groupId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
