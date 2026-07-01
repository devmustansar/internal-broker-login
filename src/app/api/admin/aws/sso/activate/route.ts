import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-helpers";
import { isAdminOrAbove } from "@/lib/auth-policy";
import { awsSsoOidcService } from "@/server/services/aws-sso-oidc.service";
import { secretManager } from "@/server/secrets/secret-manager";
import type { AwsSsoOidcPending } from "@/server/secrets/types";

/**
 * POST /api/admin/aws/sso/activate
 *
 * Step 3 of the SSO OIDC device auth flow — polled by the frontend
 * after showing the user the verification URL.
 *
 * Responses:
 *   { status: "success" }  — user approved; tokens stored; setup complete
 *   { status: "pending" }  — not approved yet; keep polling
 *   { status: "expired" }  — device code expired; restart /setup
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { resourceKey } = await req.json();
    if (!resourceKey) return badRequest("Missing required field: resourceKey");

    // Load the pending device auth session stored by /setup
    const pendingRef = `aws/resource/${resourceKey}/sso-oidc-pending`;
    let pending: AwsSsoOidcPending;

    try {
      const secret = await secretManager.getSecret(pendingRef, "aws_sso_oidc_pending");
      pending = secret.payload;
    } catch {
      return badRequest("No pending SSO setup found for this resource. Start setup first.");
    }

    try {
      const tokens = await awsSsoOidcService.createTokenFromDeviceCode(
        pending.ssoRegion,
        pending.clientId,
        pending.clientSecret,
        pending.deviceCode
      );

      // Approval received — store the OIDC credentials used for runtime token refresh
      const oidcRef = `aws/resource/${resourceKey}/sso-oidc`;
      const oidcPayload = {
        clientId: pending.clientId,
        clientSecret: pending.clientSecret,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        ssoRegion: pending.ssoRegion,
      };

      if (await secretManager.hasSecret(oidcRef)) {
        await secretManager.updateSecret(oidcRef, { payload: oidcPayload });
      } else {
        await secretManager.saveSecret({
          secretRef: oidcRef,
          kind: "aws_sso_oidc",
          payload: oidcPayload,
          metadata: { resourceKey, label: "SSO OIDC Credentials" },
        });
      }

      // Clean up the one-time pending session
      await secretManager.deleteSecret(pendingRef).catch(() => {});

      return NextResponse.json({ status: "success" });
    } catch (err: any) {
      // AWS SDK v3 surfaces the error type in .name but may set .message to
      // "UnknownError". The real OAuth error code lives in err.error and the
      // human description in err.error_description.
      const errorId: string =
        err?.name ?? err?.code ?? err?.__type ?? err?.errorCode ?? "";
      const oauthError: string = err?.error ?? "";
      const errorDesc: string = err?.error_description ?? err?.message ?? "";

      const isPending =
        errorId.includes("AuthorizationPending") ||
        oauthError === "authorization_pending";

      // invalid_grant covers: expired codes, already-consumed codes ("Session is
      // already associated with device"), and denied authorizations.
      const isExpired =
        errorId.includes("ExpiredToken") ||
        errorId.includes("InvalidGrant") ||
        errorId.includes("SlowDown") ||
        oauthError === "expired_token" ||
        oauthError === "invalid_grant" ||
        oauthError === "slow_down";

      if (isPending) return NextResponse.json({ status: "pending" });
      if (isExpired) return NextResponse.json({ status: "expired" });

      console.error("[sso/activate] Unhandled CreateToken error:", { errorId, oauthError, errorDesc, err });
      return NextResponse.json({
        status: "error",
        error: errorDesc || errorId || "Unknown error during device code exchange",
      }, { status: 500 });
    }
  } catch (err) {
    return serverError(err);
  }
}
