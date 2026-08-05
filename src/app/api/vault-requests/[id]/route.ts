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
import { notifyUsers } from "@/server/services/notification.service";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/vault-requests/[id]
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const request = await prisma.vaultRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        resource: { select: { id: true, name: true, resourceKey: true, ownerUserId: true } },
        awsResource: { select: { id: true, name: true, resourceKey: true, ownerUserId: true } },
        organization: { select: { id: true, name: true } },
      },
    });
    if (!request) return notFound("Request not found");

    const canApprove = canApproveVaultRequest(auth, request, request.resource?.ownerUserId, request.awsResource?.ownerUserId);
    if (request.requestedById !== auth.userId && !canApprove) return forbidden();

    return NextResponse.json({ ...request, canApprove });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PATCH /api/vault-requests/[id]
 * Body: { status: "APPROVED" | "REJECTED", reviewNote? }
 * Approve/reject a pending request. Does not create the credential/2FA record —
 * that happens via the separate /fulfil endpoint so a secret is never auto-generated.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
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
    if (existing.status !== "PENDING") return badRequest("Only pending requests can be approved or rejected");

    if (!canApproveVaultRequest(auth, existing, existing.resource?.ownerUserId, existing.awsResource?.ownerUserId)) {
      return forbidden();
    }

    const body = await req.json();
    if (!["APPROVED", "REJECTED"].includes(body.status)) {
      return badRequest('status must be "APPROVED" or "REJECTED"');
    }

    const updated = await prisma.vaultRequest.update({
      where: { id },
      data: {
        status: body.status,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
        reviewNote: body.reviewNote || null,
      },
    });

    await notifyUsers([existing.requestedById], {
      type: body.status === "APPROVED" ? "vault_request_approved" : "vault_request_rejected",
      title: `Your request "${existing.appName}" was ${body.status === "APPROVED" ? "approved" : "rejected"}`,
      body: body.reviewNote || undefined,
      relatedId: id,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}
