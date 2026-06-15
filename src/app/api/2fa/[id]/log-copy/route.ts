import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  serverError,
} from "@/lib/api-helpers";
import { logOtpAccess } from "@/server/services/two-factor.service";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/2fa/[id]/log-copy
 * Logs that the user copied an OTP. Best-effort — 200 even if log insert fails.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const entry = await prisma.twoFactorEntry.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!entry) return NextResponse.json({ logged: false });

    await logOtpAccess({
      twoFactorEntryId: id,
      organizationId: entry.organizationId,
      userId: auth.userId,
      action: "otp_copied",
      outcome: "success",
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        null,
      userAgent: req.headers.get("user-agent") ?? null,
    });

    return NextResponse.json({ logged: true });
  } catch {
    return NextResponse.json({ logged: false });
  }
}
