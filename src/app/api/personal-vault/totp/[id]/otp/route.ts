import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/server/secrets/encryption";
import { generateTotp } from "@/server/services/two-factor.service";
import { logPersonalVaultAction } from "@/server/services/personal-vault.service";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/personal-vault/totp/[id]/otp
 * Generates the current TOTP code server-side for the caller's own personal entry.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const entry = await prisma.personalTwoFactorEntry.findFirst({
      where: { id, ownerUserId: auth.userId, deletedAt: null },
    });
    if (!entry) return notFound("2FA entry not found");

    const plainSecret = decrypt(entry.encryptedSecret, `personal-2fa-entry:${id}`);
    const otpData = generateTotp(plainSecret, entry.algorithm, entry.digits, entry.period);

    await logPersonalVaultAction({
      userId: auth.userId,
      action: "2fa_otp_viewed",
      targetType: "2fa",
      targetId: id,
    });

    return NextResponse.json({ ...otpData, period: entry.period });
  } catch (err) {
    return serverError(err);
  }
}
