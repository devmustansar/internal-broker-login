import { NextRequest, NextResponse } from "next/server";
import { secretManager } from "@/server/secrets/secret-manager";
import { secretsAdminService } from "@/server/services/secrets-admin.service";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  notFound,
} from "@/lib/api-helpers";

/**
 * GET /api/admin/secrets?secretRef=xxx&kind=yyy
 * Fetches the decrypted secret for an admin to view/edit.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (auth.role !== "admin") return forbidden();

    const { searchParams } = new URL(req.url);
    const secretRef = searchParams.get("secretRef");
    const kind = searchParams.get("kind");

    if (!secretRef) return badRequest("Missing secretRef");

    const exists = await secretManager.hasSecret(secretRef);
    if (!exists) return notFound(`Secret '${secretRef}' not found`);

    const secret = await secretManager.getSecret(secretRef, kind as any || "generic_key_value");
    return NextResponse.json(secret);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/admin/secrets
 * Saves or updates a secret.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (auth.role !== "admin") return forbidden();

    const data = await req.json();
    const { secretRef, kind, payload, metadata } = data;

    if (!secretRef || !kind || !payload) {
      return badRequest("Missing secretRef, kind, or payload");
    }

    let result;
    if (kind === "aws_iam_credentials") {
      result = await secretsAdminService.saveOrUpdateAwsCredentials(secretRef, payload, metadata);
    } else if (kind === "web_basic_credentials") {
      result = await secretsAdminService.saveOrUpdateWebCredentials(secretRef, payload, metadata);
    } else {
      // Generic fallback
      const exists = await secretManager.hasSecret(secretRef);
      if (exists) {
        result = await secretManager.updateSecret(secretRef, { payload, metadata });
      } else {
        result = await secretManager.saveSecret({ secretRef, kind, payload, metadata });
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/secrets
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (auth.role !== "admin") return forbidden();

    const { searchParams } = new URL(req.url);
    const secretRef = searchParams.get("secretRef");

    if (!secretRef) return badRequest("Missing secretRef");

    await secretsAdminService.deleteSecret(secretRef);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
