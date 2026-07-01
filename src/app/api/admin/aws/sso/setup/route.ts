import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-helpers";
import { isAdminOrAbove } from "@/lib/auth-policy";
import { awsSsoOidcService } from "@/server/services/aws-sso-oidc.service";
import { secretManager } from "@/server/secrets/secret-manager";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/aws/sso/setup
 *
 * Steps 1 + 2 of the SSO OIDC device auth flow:
 *   1. Registers the broker as a public OIDC client (no IAM creds needed)
 *   2. Starts device authorization — returns the URL + code for the user to approve
 *   3. Stores the pending session in secrets so /activate can complete the flow
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const body = await req.json();
    const { resourceKey, ssoStartUrl, ssoRegion } = body;

    if (!resourceKey || !ssoStartUrl || !ssoRegion) {
      return badRequest("Missing required fields: resourceKey, ssoStartUrl, ssoRegion");
    }

    const resource = await prisma.awsResource.findUnique({ where: { resourceKey } });
    if (!resource) return badRequest("AWS resource not found");

    // Step 1 — register OIDC client (public endpoint, no IAM credentials needed)
    const registration = await awsSsoOidcService.registerClient(ssoRegion);

    // Step 2 — start device authorization
    const session = await awsSsoOidcService.startDeviceAuthorization(
      ssoRegion,
      ssoStartUrl,
      registration.clientId,
      registration.clientSecret
    );

    // Persist the pending session so /activate can use it
    const pendingRef = `aws/resource/${resourceKey}/sso-oidc-pending`;
    const pendingPayload = {
      clientId: registration.clientId,
      clientSecret: registration.clientSecret,
      deviceCode: session.deviceCode,
      ssoRegion,
      ssoStartUrl,
    };

    if (await secretManager.hasSecret(pendingRef)) {
      await secretManager.updateSecret(pendingRef, { payload: pendingPayload });
    } else {
      await secretManager.saveSecret({
        secretRef: pendingRef,
        kind: "aws_sso_oidc_pending",
        payload: pendingPayload,
        metadata: { resourceKey, label: "SSO OIDC Pending Device Auth" },
      });
    }

    return NextResponse.json({
      verificationUri: session.verificationUri,
      verificationUriComplete: session.verificationUriComplete,
      userCode: session.userCode,
      expiresIn: session.expiresIn,
      interval: session.interval,
    });
  } catch (err) {
    return serverError(err);
  }
}
