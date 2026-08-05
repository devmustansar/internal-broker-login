import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { canApproveVaultRequest } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import { decryptPayload, decrypt, encryptPayload } from "@/server/secrets/encryption";
import { encryptSecret, logManagementAction } from "@/server/services/two-factor.service";
import { notifyUsers } from "@/server/services/notification.service";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/vault-requests/[id]/fulfil
 * Converts an APPROVED request into a real SharedCredential or TwoFactorEntry,
 * using the secret material the requester submitted with the request (decrypted
 * server-side, re-encrypted into the new record). The admin is approving/vouching
 * for a secret the user already has, not authoring a new one.
 * Once created, the request's own copy of the secret is purged — it lives only
 * in the new record from that point on. Does not grant the requester access;
 * sharing/assignment remains a separate step.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.vaultRequest.findUnique({
      where: { id },
      include: {
        resource: { select: { ownerUserId: true } },
        awsResource: { select: { ownerUserId: true } },
      },
    });
    if (!existing) return notFound("Request not found");
    if (existing.status !== "APPROVED") return badRequest("Only approved requests can be fulfilled");
    if (!canApproveVaultRequest(auth, existing, existing.resource?.ownerUserId, existing.awsResource?.ownerUserId)) {
      return forbidden();
    }

    if (existing.type === "REQUEST_ORG_CREDENTIAL") {
      if (!existing.encryptedPayload) return badRequest("Request has no submitted credential to fulfil");

      const { username, password } = decryptPayload<{ username: string; password: string }>(existing.encryptedPayload, `vault-request:${id}`);
      const body = await req.json().catch(() => ({}));

      const credential = await prisma.sharedCredential.create({
        data: {
          appName: existing.appName,
          loginUrl: existing.loginUrl,
          description: body.description || null,
          encryptedPayload: encryptPayload({ username, password }),
          organizationId: existing.organizationId,
          createdBy: auth.userId,
          ownerUserId: auth.userId,
        },
        select: { id: true, appName: true, organizationId: true },
      });

      await prisma.vaultRequest.update({
        where: { id },
        data: {
          status: "COMPLETED",
          createdCredentialId: credential.id,
          encryptedPayload: null,
        },
      });

      await logManagementAction({
        action: "credential_created",
        userId: auth.userId,
        organizationId: existing.organizationId,
        details: { credentialId: credential.id, appName: credential.appName, fulfilledRequestId: id },
      });

      await notifyUsers([existing.requestedById], {
        type: "vault_request_completed",
        title: `Your request "${existing.appName}" was fulfilled`,
        relatedId: id,
      });

      return NextResponse.json({ credential });
    }

    // REQUEST_ORG_2FA
    if (!existing.encryptedSecret) return badRequest("Request has no submitted 2FA secret to fulfil");

    const secret = decrypt(existing.encryptedSecret, `vault-request:${id}`);

    const entry = await prisma.twoFactorEntry.create({
      data: {
        organizationId: existing.organizationId,
        appName: existing.appName,
        encryptedSecret: encryptSecret(secret),
        algorithm: existing.algorithm ?? "SHA1",
        digits: existing.digits ?? 6,
        period: existing.period ?? 30,
        createdById: auth.userId,
        ownerId: auth.userId,
        resourceId: existing.resourceId,
        awsResourceId: existing.awsResourceId,
      },
      select: { id: true, appName: true, organizationId: true },
    });

    await prisma.vaultRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        createdTwoFactorEntryId: entry.id,
        encryptedSecret: null,
      },
    });

    await logManagementAction({
      action: "2fa_entry_created",
      userId: auth.userId,
      organizationId: existing.organizationId,
      details: { entryId: entry.id, appName: entry.appName, fulfilledRequestId: id },
    });

    await notifyUsers([existing.requestedById], {
      type: "vault_request_completed",
      title: `Your request "${existing.appName}" was fulfilled`,
      relatedId: id,
    });

    return NextResponse.json({ entry });
  } catch (err) {
    return serverError(err);
  }
}
