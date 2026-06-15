import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  generateTotp,
  logOtpAccess,
} from "@/server/services/two-factor.service";

type Params = { params: Promise<{ id: string }> };

function getIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/**
 * GET /api/2fa/[id]/otp
 * Generates and returns the current TOTP code for an assigned entry.
 * The encrypted secret is decrypted server-side; only the OTP code is returned.
 * Access is logged atomically.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ip = getIp(req);
  const ua = req.headers.get("user-agent") ?? null;

  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.twoFactorEntry.findUnique({
        where: { id },
        select: {
          id: true,
          encryptedSecret: true,
          algorithm: true,
          digits: true,
          period: true,
          status: true,
          deletedAt: true,
          organizationId: true,
        },
      });

      if (!entry || entry.deletedAt !== null) {
        return { error: "not_found" as const };
      }

      if (entry.status !== "active") {
        await tx.twoFactorAccessLog.create({
          data: {
            twoFactorEntryId: id,
            organizationId: entry.organizationId,
            userId: auth.userId,
            action: "unauthorized_access_attempt",
            outcome: "failure",
            ipAddress: ip,
            userAgent: ua,
            details: { reason: "entry_disabled" },
          },
        });
        return { error: "disabled" as const };
      }

      const assignment = await tx.twoFactorAssignment.findFirst({
        where: { twoFactorEntryId: id, assignedToUserId: auth.userId },
      });

      if (!assignment) {
        await tx.twoFactorAccessLog.create({
          data: {
            twoFactorEntryId: id,
            organizationId: entry.organizationId,
            userId: auth.userId,
            action: "unauthorized_access_attempt",
            outcome: "failure",
            ipAddress: ip,
            userAgent: ua,
            details: { reason: "no_assignment" },
          },
        });
        return { error: "forbidden" as const };
      }

      const plainSecret = decryptSecret(entry.encryptedSecret, entry.id);
      const otpData = generateTotp(plainSecret, entry.algorithm, entry.digits, entry.period);

      await tx.twoFactorAccessLog.create({
        data: {
          twoFactorEntryId: id,
          organizationId: entry.organizationId,
          userId: auth.userId,
          action: "otp_viewed",
          outcome: "success",
          ipAddress: ip,
          userAgent: ua,
        },
      });

      return { data: { ...otpData, period: entry.period } };
    });

    if (result.error === "not_found") return notFound("2FA entry not found");
    if (result.error === "disabled") return forbidden("2FA entry is disabled");
    if (result.error === "forbidden") return forbidden("Not assigned to this 2FA entry");

    return NextResponse.json(result.data!);
  } catch (err) {
    return serverError(err);
  }
}
