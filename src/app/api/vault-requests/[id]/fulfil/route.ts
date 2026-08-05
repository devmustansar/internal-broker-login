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
import { encryptPayload } from "@/server/secrets/encryption";
import { encryptSecret, logManagementAction } from "@/server/services/two-factor.service";
import { notifyUsers } from "@/server/services/notification.service";

type Params = { params: Promise<{ id: string }> };

const VALID_ALGORITHMS = ["SHA1", "SHA256", "SHA512"];
const VALID_DIGITS = [6, 8];
const VALID_PERIODS = [30, 60];
const BASE32_RE = /^[A-Z2-7]+=*$/i;

/**
 * POST /api/vault-requests/[id]/fulfil
 * Converts an APPROVED request into a real SharedCredential or TwoFactorEntry.
 * The admin supplies the actual secret here — it is never auto-generated or
 * copied from the request (the request only ever carried metadata).
 * Does not grant the requester access; sharing/assignment remains a separate step.
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

    const body = await req.json();

    if (existing.type === "REQUEST_ORG_CREDENTIAL") {
      const { username, password, description } = body;
      if (!username || !password) return badRequest("username and password are required");

      const credential = await prisma.sharedCredential.create({
        data: {
          appName: existing.appName,
          loginUrl: existing.loginUrl,
          description: description || null,
          encryptedPayload: encryptPayload({ username, password }),
          organizationId: existing.organizationId,
          createdBy: auth.userId,
          ownerUserId: auth.userId,
        },
        select: { id: true, appName: true, organizationId: true },
      });

      await prisma.vaultRequest.update({
        where: { id },
        data: { status: "COMPLETED", createdCredentialId: credential.id },
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
    const { secret, algorithm = "SHA1", digits = 6, period = 30 } = body;
    if (!secret) return badRequest("secret is required");
    const clean = secret.toUpperCase().replace(/\s/g, "");
    if (!BASE32_RE.test(clean)) return badRequest("Invalid Base32 secret");
    const algo = algorithm.toUpperCase();
    if (!VALID_ALGORITHMS.includes(algo)) return badRequest(`algorithm must be one of: ${VALID_ALGORITHMS.join(", ")}`);
    if (!VALID_DIGITS.includes(digits)) return badRequest("digits must be 6 or 8");
    if (!VALID_PERIODS.includes(period)) return badRequest("period must be 30 or 60");

    const entry = await prisma.twoFactorEntry.create({
      data: {
        organizationId: existing.organizationId,
        appName: existing.appName,
        encryptedSecret: encryptSecret(clean),
        algorithm: algo,
        digits,
        period,
        createdById: auth.userId,
        ownerId: auth.userId,
        resourceId: existing.resourceId,
        awsResourceId: existing.awsResourceId,
      },
      select: { id: true, appName: true, organizationId: true },
    });

    await prisma.vaultRequest.update({
      where: { id },
      data: { status: "COMPLETED", createdTwoFactorEntryId: entry.id },
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
