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
 * POST /api/admin/credentials/[id]/share
 * Share a credential with a specific user.
 * Body: { userId: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id } = await params;
    const { userId } = await req.json();
    if (!userId) return badRequest("userId is required");

    const credential = await prisma.sharedCredential.findUnique({ where: { id } });
    if (!credential) return notFound("Credential not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, credential.organizationId)) {
      return forbidden();
    }

    const share = await prisma.credentialShare.upsert({
      where: { credentialId_userId: { credentialId: id, userId } },
      create: { credentialId: id, userId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(share, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/credentials/[id]/share
 * Revoke a credential share.
 * Body: { userId: string }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id } = await params;
    const { userId } = await req.json();
    if (!userId) return badRequest("userId is required");

    const credential = await prisma.sharedCredential.findUnique({ where: { id } });
    if (!credential) return notFound("Credential not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, credential.organizationId)) {
      return forbidden();
    }

    await prisma.credentialShare.deleteMany({
      where: { credentialId: id, userId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
