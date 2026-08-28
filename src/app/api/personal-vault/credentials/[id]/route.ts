import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { encryptPayload, decryptPayload } from "@/server/secrets/encryption";
import { logPersonalVaultAction } from "@/server/services/personal-vault.service";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/personal-vault/credentials/[id]
 * Metadata only — no raw password. Scoped strictly to ownerUserId; a mismatch
 * looks identical to "not found" so existence of another user's row is never leaked.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const credential = await prisma.personalCredential.findFirst({
      where: { id, ownerUserId: auth.userId },
    });
    if (!credential) return notFound("Credential not found");

    const decrypted = decryptPayload<{ username: string }>(credential.encryptedPayload, `personal-credential:${id}`);
    return NextResponse.json({ ...credential, encryptedPayload: undefined, username: decrypted.username });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PATCH /api/personal-vault/credentials/[id]
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.personalCredential.findFirst({ where: { id, ownerUserId: auth.userId } });
    if (!existing) return notFound("Credential not found");

    const data = await req.json();
    const updateData: any = {};
    if (data.appName !== undefined) updateData.appName = data.appName;
    if ("loginUrl" in data) updateData.loginUrl = data.loginUrl || null;
    if ("description" in data) updateData.description = data.description || null;

    let secretChanged = false;
    if (data.username || data.password) {
      const current = decryptPayload<{ username: string; password: string }>(existing.encryptedPayload, `personal-credential:${id}`);
      updateData.encryptedPayload = encryptPayload({
        username: data.username || current.username,
        password: data.password || current.password,
      });
      secretChanged = !!data.password;
    }

    const updated = await prisma.personalCredential.update({
      where: { id },
      data: updateData,
      select: { id: true, appName: true, loginUrl: true, description: true, updatedAt: true },
    });

    await logPersonalVaultAction({
      userId: auth.userId,
      action: secretChanged ? "credential_secret_rotated" : "credential_updated",
      targetType: "credential",
      targetId: id,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/personal-vault/credentials/[id]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.personalCredential.findFirst({ where: { id, ownerUserId: auth.userId } });
    if (!existing) return notFound("Credential not found");

    await prisma.personalCredential.delete({ where: { id } });

    await logPersonalVaultAction({
      userId: auth.userId,
      action: "credential_deleted",
      targetType: "credential",
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
