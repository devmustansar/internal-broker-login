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
import { decryptPayload, decrypt } from "@/server/secrets/encryption";
import { logManagementAction } from "@/server/services/two-factor.service";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/vault-requests/[id]/reveal
 * Returns the requester-submitted secret material (credential username/password,
 * or 2FA Base32 secret + config). Allowed for the requester (reviewing their own
 * submission) or an approver (verifying before approve/fulfil). Only while the
 * secret still exists — it's purged once the request is rejected or fulfilled.
 * Every call is audited.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const request = await prisma.vaultRequest.findUnique({
      where: { id },
      include: {
        resource: { select: { ownerUserId: true } },
        awsResource: { select: { ownerUserId: true } },
      },
    });
    if (!request) return notFound("Request not found");

    const canApprove = canApproveVaultRequest(auth, request, request.resource?.ownerUserId, request.awsResource?.ownerUserId);
    if (request.requestedById !== auth.userId && !canApprove) return forbidden();

    if (!request.encryptedPayload && !request.encryptedSecret) {
      return badRequest("No secret is stored on this request");
    }

    let result: Record<string, unknown>;
    if (request.type === "REQUEST_ORG_CREDENTIAL") {
      const decrypted = decryptPayload<{ username: string; password: string }>(request.encryptedPayload!, `vault-request:${id}`);
      result = { username: decrypted.username, password: decrypted.password };
    } else {
      const secret = decrypt(request.encryptedSecret!, `vault-request:${id}`);
      result = { secret, algorithm: request.algorithm, digits: request.digits, period: request.period };
    }

    await logManagementAction({
      action: "vault_request_secret_revealed",
      userId: auth.userId,
      organizationId: request.organizationId,
      details: { requestId: id, viewerIsRequester: request.requestedById === auth.userId },
    });

    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
