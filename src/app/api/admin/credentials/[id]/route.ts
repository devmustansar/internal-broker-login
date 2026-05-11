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
import { encryptPayload, decryptPayload } from "@/server/secrets/encryption";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/credentials/[id]
 * Get a single credential with decrypted payload (admin only).
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id } = await params;
    const credential = await prisma.sharedCredential.findUnique({
      where: { id },
      include: {
        groups: { include: { group: { select: { id: true, name: true } } } },
        shares: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    if (!credential) return notFound("Credential not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, credential.organizationId)) {
      return forbidden();
    }

    // Decrypt payload for admin
    const decrypted = decryptPayload<{ username: string; password: string }>(
      credential.encryptedPayload,
      `credential:${id}`
    );

    return NextResponse.json({
      ...credential,
      encryptedPayload: undefined,
      username: decrypted.username,
      password: decrypted.password,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PUT /api/admin/credentials/[id]
 * Update credential fields. Re-encrypts payload if username/password provided.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id } = await params;
    const existing = await prisma.sharedCredential.findUnique({ where: { id } });
    if (!existing) return notFound("Credential not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, existing.organizationId)) {
      return forbidden();
    }

    const data = await req.json();
    const updateData: any = {};

    if (data.appName !== undefined) updateData.appName = data.appName;
    if (data.loginUrl !== undefined) updateData.loginUrl = data.loginUrl;
    if (data.description !== undefined) updateData.description = data.description;

    // Re-encrypt if credentials changed
    if (data.username || data.password) {
      const currentPayload = decryptPayload<{ username: string; password: string }>(
        existing.encryptedPayload,
        `credential:${id}`
      );
      updateData.encryptedPayload = encryptPayload({
        username: data.username || currentPayload.username,
        password: data.password || currentPayload.password,
      });
    }

    const updated = await prisma.sharedCredential.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        appName: true,
        loginUrl: true,
        description: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/credentials/[id]
 * Hard-delete a credential (cascades to shares and group entries).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { id } = await params;
    const existing = await prisma.sharedCredential.findUnique({ where: { id } });
    if (!existing) return notFound("Credential not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, existing.organizationId)) {
      return forbidden();
    }

    await prisma.sharedCredential.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
