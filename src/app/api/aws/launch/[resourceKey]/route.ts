import { NextRequest, NextResponse } from "next/server";
import { awsBrokerService } from "@/server/services/aws-broker.service";
import {
  getAuthContext,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api-helpers";

/**
 * POST /api/aws/launch/[resourceKey]
 *
 * Initiates an AWS Console federation login for the authenticated portal user.
 *
 * Request: no body required (resourceKey is in the URL path)
 *
 * Success response (200):
 * {
 *   "launchId": "uuid",
 *   "loginUrl": "https://signin.aws.amazon.com/federation?Action=login&...",
 *   "expiresAt": "2024-01-01T11:00:00.000Z",
 *   "awsAccountId": "123456789012",
 *   "roleArn": "arn:aws:iam::123456789012:role/BrokerConsoleRole"
 * }
 *
 * Error responses:
 *   401 - Not authenticated
 *   400 - resourceKey missing or malformed
 *   403 - User not entitled to this AWS resource
 *   404 - AWS resource not found
 *   500 - STS/federation error (sanitised message, no AWS internals)
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ resourceKey: string }> }
) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────────
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    // ── Validate path param ────────────────────────────────────────────────────
    const { resourceKey } = await ctx.params;
    if (!resourceKey || typeof resourceKey !== "string" || resourceKey.length > 128) {
      return badRequest("resourceKey path parameter is required and must be a non-empty string");
    }

    // Reject obviously invalid keys early (same pattern as resource table)
    if (!/^[a-z0-9_-]+$/i.test(resourceKey)) {
      return badRequest("resourceKey contains invalid characters");
    }

    // ── Extract request metadata for audit logging ─────────────────────────────
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    // ── Launch ─────────────────────────────────────────────────────────────────
    const result = await awsBrokerService.launchAwsConsole(auth.userId, {
      resourceKey,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";

    // Map well-known error messages to appropriate HTTP status codes
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (
      message.includes("does not have entitlement") ||
      message.includes("Forbidden")
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return serverError(err);
  }
}
