import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { encryptPayload, decryptPayload } from "@/server/secrets/encryption";
import { logPersonalVaultAction } from "@/server/services/personal-vault.service";

/**
 * GET /api/personal-vault/credentials
 * Lists the current user's own personal credentials. Never returns raw passwords —
 * use /api/personal-vault/credentials/[id]/reveal for that.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const credentials = await prisma.personalCredential.findMany({
      where: { ownerUserId: auth.userId },
      orderBy: { createdAt: "desc" },
    });

    const result = credentials.map((cred) => {
      let username: string | null = null;
      try {
        username = decryptPayload<{ username: string }>(cred.encryptedPayload, `personal-credential:${cred.id}`).username;
      } catch {
        // leave null if decryption fails
      }
      const { encryptedPayload: _, ...rest } = cred;
      return { ...rest, username };
    });

    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/personal-vault/credentials
 * Creates a new personal credential owned solely by the current user.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const data = await req.json();
    const { appName, loginUrl, description, username, password } = data;
    if (!appName || !username || !password) {
      return badRequest("Missing required fields: appName, username, password");
    }

    const credential = await prisma.personalCredential.create({
      data: {
        ownerUserId: auth.userId,
        appName,
        loginUrl: loginUrl || null,
        description: description || null,
        encryptedPayload: encryptPayload({ username, password }),
      },
      select: { id: true, appName: true, loginUrl: true, description: true, createdAt: true },
    });

    await logPersonalVaultAction({
      userId: auth.userId,
      action: "credential_created",
      targetType: "credential",
      targetId: credential.id,
    });

    return NextResponse.json(credential, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
