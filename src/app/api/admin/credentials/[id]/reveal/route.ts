import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { canEditCredential } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import { decryptPayload } from "@/server/secrets/encryption";
import { logManagementAction } from "@/server/services/two-factor.service";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/credentials/[id]/reveal
 * The only endpoint that returns a raw credential password. Every call is audited.
 * Allowed for: super_admin, admin, org owner/admin, or the credential's resource owner.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.sharedCredential.findUnique({ where: { id } });
    if (!existing) return notFound("Credential not found");
    if (!canEditCredential(auth, existing)) return forbidden();

    const decrypted = decryptPayload<{ username: string; password: string }>(
      existing.encryptedPayload,
      `credential:${id}`
    );

    await logManagementAction({
      action: "credential_revealed",
      userId: auth.userId,
      organizationId: existing.organizationId,
      details: { credentialId: id, appName: existing.appName },
    });

    return NextResponse.json({ username: decrypted.username, password: decrypted.password });
  } catch (err) {
    return serverError(err);
  }
}
