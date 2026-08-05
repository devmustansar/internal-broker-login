import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { canRequestForOrg, isAdminOrAbove, getOrgFilter } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import { notifyUsers, getVaultRequestStakeholderIds } from "@/server/services/notification.service";

const VALID_TYPES = ["REQUEST_ORG_CREDENTIAL", "REQUEST_ORG_2FA"];

/**
 * GET /api/vault-requests
 * Admins/owners/resource owners: requests within their scope (any status, filterable via ?status=).
 * Everyone else: only their own requests.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const status = req.nextUrl.searchParams.get("status");
    const scope = req.nextUrl.searchParams.get("scope"); // "mine" | "queue"

    const where: any = {};
    if (status) where.status = status;

    if (scope === "mine") {
      where.requestedById = auth.userId;
    } else if (isAdminOrAbove(auth)) {
      Object.assign(where, getOrgFilter(auth));
    } else if (auth.isResourceOwner) {
      // Resource owner without org admin role: requests for resources/AWS resources they own
      const [ownedResources, ownedAwsResources] = await Promise.all([
        prisma.resource.findMany({ where: { ownerUserId: auth.userId }, select: { id: true } }),
        prisma.awsResource.findMany({ where: { ownerUserId: auth.userId }, select: { id: true } }),
      ]);
      where.OR = [
        { requestedById: auth.userId },
        { resourceId: { in: ownedResources.map((r) => r.id) } },
        { awsResourceId: { in: ownedAwsResources.map((r) => r.id) } },
      ];
    } else {
      where.requestedById = auth.userId;
    }

    const requests = await prisma.vaultRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        resource: { select: { id: true, name: true, resourceKey: true } },
        awsResource: { select: { id: true, name: true, resourceKey: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(requests);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/vault-requests
 * A member requests an org credential or 2FA entry be created for their org.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const data = await req.json();
    const { type, organizationId, resourceId, awsResourceId, appName, loginUrl, justification } = data;

    if (!VALID_TYPES.includes(type)) return badRequest(`type must be one of: ${VALID_TYPES.join(", ")}`);
    if (!organizationId) return badRequest("organizationId is required");
    if (!appName?.trim()) return badRequest("appName is required");
    if (resourceId && awsResourceId) return badRequest("Provide at most one of resourceId, awsResourceId");

    if (!canRequestForOrg(auth, organizationId)) {
      return forbidden("You must belong to this organization to request access for it");
    }

    let resourceOwnerUserId: string | null = null;
    let awsResourceOwnerUserId: string | null = null;

    if (resourceId) {
      const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
      if (!resource || resource.organizationId !== organizationId) return badRequest("resourceId does not belong to this organization");
      resourceOwnerUserId = resource.ownerUserId;
    }
    if (awsResourceId) {
      const awsResource = await prisma.awsResource.findUnique({ where: { id: awsResourceId } });
      if (!awsResource || awsResource.organizationId !== organizationId) return badRequest("awsResourceId does not belong to this organization");
      awsResourceOwnerUserId = awsResource.ownerUserId;
    }

    const request = await prisma.vaultRequest.create({
      data: {
        type,
        organizationId,
        resourceId: resourceId || null,
        awsResourceId: awsResourceId || null,
        appName: appName.trim(),
        loginUrl: loginUrl || null,
        justification: justification || null,
        requestedById: auth.userId,
      },
    });

    const stakeholderIds = await getVaultRequestStakeholderIds({
      organizationId,
      resourceOwnerUserId,
      awsResourceOwnerUserId,
    });

    await notifyUsers(stakeholderIds, {
      type: "vault_request_created",
      title: `New ${type === "REQUEST_ORG_CREDENTIAL" ? "credential" : "2FA"} request: ${request.appName}`,
      body: justification || undefined,
      relatedId: request.id,
    });

    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
