import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, unauthorized, badRequest, serverError } from "@/lib/api-helpers";
import { parseQrImageBuffer, parseQrUri, logManagementAction } from "@/server/services/two-factor.service";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * POST /api/vault-requests/qr-parse
 * Member-facing QR decode for the "Request Credential / 2FA" flow — any authenticated
 * user can parse a QR image/frame here (unlike /api/admin/2fa/qr-parse, which is admin-only),
 * since this only decodes an image the user already possesses; it writes nothing to the vault.
 * Image is never stored. Secret is returned only to the browser that uploaded it.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) return badRequest("image field is required");
    if (!ALLOWED_TYPES.includes(file.type)) return badRequest("Image must be PNG, JPEG, WebP, or GIF");
    if (file.size > MAX_SIZE) return badRequest("Image must be under 5 MB");

    const buffer = Buffer.from(await file.arrayBuffer());
    const uri = await parseQrImageBuffer(buffer);

    let result;
    try {
      result = parseQrUri(uri);
    } catch (e: any) {
      return badRequest(e.message);
    }

    if (result.type === "migration") {
      return badRequest("Google Authenticator migration QR codes aren't supported here — scan a single-account otpauth:// QR code instead.");
    }

    await logManagementAction({
      action: "2fa_qr_parsed",
      userId: auth.userId,
      organizationId: "n/a",
      details: { context: "vault_request", issuer: result.issuer, accountLabel: result.accountLabel },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message?.includes("No QR code")) return badRequest(err.message);
    return serverError(err);
  }
}
