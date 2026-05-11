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
 * POST /api/admin/credential-groups/[id]/members
 * Add a user to a credential group.
 * Body: { userId: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id: groupId } = await params;
    const { userId } = await req.json();
    if (!userId) return badRequest("userId is required");

    const group = await prisma.credentialGroup.findUnique({ where: { id: groupId } });
    if (!group) return notFound("Group not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, group.organizationId)) {
      return forbidden();
    }

    const member = await prisma.credentialGroupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/credential-groups/[id]/members
 * Remove a user from a credential group.
 * Body: { userId: string }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id: groupId } = await params;
    const { userId } = await req.json();
    if (!userId) return badRequest("userId is required");

    const group = await prisma.credentialGroup.findUnique({ where: { id: groupId } });
    if (!group) return notFound("Group not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, group.organizationId)) {
      return forbidden();
    }

    await prisma.credentialGroupMember.deleteMany({
      where: { groupId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
