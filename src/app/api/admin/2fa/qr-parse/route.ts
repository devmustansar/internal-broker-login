import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove } from "@/lib/auth-policy";
import {
  parseQrImageBuffer,
  parseQrUri,
  logManagementAction,
} from "@/server/services/two-factor.service";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * POST /api/admin/2fa/qr-parse
 * Accepts multipart/form-data with an "image" field.
 *
 * Returns a discriminated QrParseResult:
 *   { type: "totp", secret, issuer, accountLabel, algorithm, digits, period, rawUri }
 *   { type: "migration", entries: [...], skippedHotp }
 *
 * Image is never stored. Secret is returned in plaintext to the admin UI only.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    console.log("file==============================")

    if (!file) return badRequest("image field is required");
    if (!ALLOWED_TYPES.includes(file.type)) {
      return badRequest("Image must be PNG, JPEG, WebP, or GIF");
    }
    if (file.size > MAX_SIZE) return badRequest("Image must be under 5 MB");
    console.log("file==============================222222222")

    const buffer = Buffer.from(await file.arrayBuffer());
    console.log("buffer==============================")
    const uri = await parseQrImageBuffer(buffer);
    console.log("uri==============================", uri)

    let result;
    try {
      result = parseQrUri(uri);
      console.log("result==============================", result)
    } catch (e: any) {
      return badRequest(e.message);
    }

    await logManagementAction({
      action: "2fa_qr_parsed",
      userId: auth.userId,
      organizationId: "n/a",
      details:
        result.type === "migration"
          ? { type: "migration", count: result.entries.length, skippedHotp: result.skippedHotp }
          : { type: "totp", issuer: result.issuer, accountLabel: result.accountLabel },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message?.includes("No QR code")) return badRequest(err.message);
    return serverError(err);
  }
}
