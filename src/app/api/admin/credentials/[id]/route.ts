import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, canEditCredential } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import { encryptPayload, decryptPayload } from "@/server/secrets/encryption";
import { logManagementAction } from "@/server/services/two-factor.service";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/credentials/[id]
 * Get a single credential's metadata (no raw password — use the /reveal endpoint for that).
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const credential = await prisma.sharedCredential.findUnique({
      where: { id },
      include: {
        groups: { include: { group: { select: { id: true, name: true } } } },
        shares: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    if (!credential) return notFound("Credential not found");
    if (!canEditCredential(auth, credential) && !isAdminOrAbove(auth)) {
      return forbidden();
    }

    const decrypted = decryptPayload<{ username: string }>(
      credential.encryptedPayload,
      `credential:${id}`
    );

    return NextResponse.json({
      ...credential,
      encryptedPayload: undefined,
      username: decrypted.username,
      canEdit: canEditCredential(auth, credential),
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PUT /api/admin/credentials/[id]
 * Update credential fields. Re-encrypts payload if username/password provided.
 * Allowed for: super_admin, admin, org owner/admin, or the credential's resource owner.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.sharedCredential.findUnique({ where: { id } });
    if (!existing) return notFound("Credential not found");
    if (!canEditCredential(auth, existing)) return forbidden();

    const data = await req.json();
    const updateData: any = {};

    if (data.appName !== undefined) updateData.appName = data.appName;
    if ("loginUrl" in data) updateData.loginUrl = data.loginUrl || null;
    if ("description" in data) updateData.description = data.description || null;

    let secretRotated = false;
    // Re-encrypt if credentials changed. Empty string means "no change" (never used to blank a value —
    // callers that want to clear must send the field explicitly with a non-empty replacement).
    if (data.username || data.password) {
      const currentPayload = decryptPayload<{ username: string; password: string }>(
        existing.encryptedPayload,
        `credential:${id}`
      );
      updateData.encryptedPayload = encryptPayload({
        username: data.username ?? currentPayload.username,
        password: data.password ?? currentPayload.password,
      });
      secretRotated = !!data.password;
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

    await logManagementAction({
      action: secretRotated ? "credential_secret_rotated" : "credential_updated",
      userId: auth.userId,
      organizationId: existing.organizationId,
      details: { credentialId: id, appName: updated.appName },
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

    const { id } = await params;
    const existing = await prisma.sharedCredential.findUnique({ where: { id } });
    if (!existing) return notFound("Credential not found");
    if (!canEditCredential(auth, existing)) return forbidden();

    await prisma.sharedCredential.delete({ where: { id } });

    await logManagementAction({
      action: "credential_deleted",
      userId: auth.userId,
      organizationId: existing.organizationId,
      details: { credentialId: id, appName: existing.appName },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
