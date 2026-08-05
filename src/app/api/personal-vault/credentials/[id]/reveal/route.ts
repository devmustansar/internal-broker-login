import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptPayload } from "@/server/secrets/encryption";
import { logPersonalVaultAction } from "@/server/services/personal-vault.service";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/personal-vault/credentials/[id]/reveal
 * The only endpoint that returns a raw personal credential password. Audited per call.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.personalCredential.findFirst({ where: { id, ownerUserId: auth.userId } });
    if (!existing) return notFound("Credential not found");

    const decrypted = decryptPayload<{ username: string; password: string }>(existing.encryptedPayload, `personal-credential:${id}`);

    await logPersonalVaultAction({
      userId: auth.userId,
      action: "credential_revealed",
      targetType: "credential",
      targetId: id,
    });

    return NextResponse.json({ username: decrypted.username, password: decrypted.password });
  } catch (err) {
    return serverError(err);
  }
}
