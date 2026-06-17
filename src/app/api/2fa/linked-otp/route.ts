import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  badRequest,
  forbidden,
  serverError,
} from "@/lib/api-helpers";
import { canManageOrg, isSuperAdmin } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import { decryptSecret, generateTotp } from "@/server/services/two-factor.service";

function getIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/**
 * GET /api/2fa/linked-otp?resourceId=xxx
 *     /api/2fa/linked-otp?awsResourceId=xxx
 *     /api/2fa/linked-otp?credentialId=xxx
 *
 * Returns live TOTP codes for all active 2FA entries linked to the given
 * resource or credential. Caller must have access to that resource/credential.
 * Access is audit-logged.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const p = req.nextUrl.searchParams;
    const resourceId = p.get("resourceId") ?? undefined;
    const awsResourceId = p.get("awsResourceId") ?? undefined;
    const credentialId = p.get("credentialId") ?? undefined;

    if (!resourceId && !awsResourceId && !credentialId) {
      return badRequest("Provide resourceId, awsResourceId, or credentialId");
    }

    // ── Access control ────────────────────────────────────────────────────────
    if (!isSuperAdmin(auth)) {
      let granted = false;

      if (resourceId) {
        const res = await prisma.resource.findUnique({
          where: { id: resourceId },
          select: { organizationId: true },
        });
        if (res?.organizationId && canManageOrg(auth, res.organizationId)) {
          granted = true;
        } else {
          const access = await prisma.userResourceAccess.findFirst({
            where: { userId: auth.userId, resourceId },
          });
          granted = !!access;
        }
      } else if (awsResourceId) {
        const res = await prisma.awsResource.findUnique({
          where: { id: awsResourceId },
          select: { organizationId: true },
        });
        if (res?.organizationId && canManageOrg(auth, res.organizationId)) {
          granted = true;
        } else {
          const access = await prisma.userResourceAccess.findFirst({
            where: { userId: auth.userId, awsResourceId },
          });
          granted = !!access;
        }
      } else if (credentialId) {
        const cred = await prisma.sharedCredential.findUnique({
          where: { id: credentialId },
          select: { organizationId: true },
        });
        if (cred?.organizationId && canManageOrg(auth, cred.organizationId)) {
          granted = true;
        } else {
          const directShare = await prisma.credentialShare.findFirst({
            where: { userId: auth.userId, credentialId },
          });
          if (directShare) {
            granted = true;
          } else {
            const groupAccess = await prisma.credentialGroupMember.findFirst({
              where: {
                userId: auth.userId,
                group: { credentials: { some: { credentialId } } },
              },
            });
            granted = !!groupAccess;
          }
        }
      }

      if (!granted) return forbidden();
    }

    // ── Fetch linked 2FA entries ──────────────────────────────────────────────
    const where = {
      deletedAt: null,
      status: "active" as const,
      ...(resourceId ? { resourceId } : {}),
      ...(awsResourceId ? { awsResourceId } : {}),
      ...(credentialId ? { credentialId } : {}),
    };

    const entries = await prisma.twoFactorEntry.findMany({
      where,
      select: {
        id: true,
        appName: true,
        issuer: true,
        accountLabel: true,
        encryptedSecret: true,
        algorithm: true,
        digits: true,
        period: true,
        organizationId: true,
      },
    });

    // ── Generate OTPs ─────────────────────────────────────────────────────────
    const result = entries.map((entry) => {
      const plain = decryptSecret(entry.encryptedSecret, entry.id);
      const { otp, remainingSeconds, expiresAt } = generateTotp(
        plain,
        entry.algorithm,
        entry.digits,
        entry.period
      );
      return {
        id: entry.id,
        appName: entry.appName,
        issuer: entry.issuer,
        accountLabel: entry.accountLabel,
        otp,
        remainingSeconds,
        expiresAt,
        period: entry.period,
        digits: entry.digits,
      };
    });

    // ── Audit log (fire and forget) ───────────────────────────────────────────
    const ip = getIp(req);
    prisma.twoFactorAccessLog
      .createMany({
        data: entries.map((e) => ({
          twoFactorEntryId: e.id,
          organizationId: e.organizationId,
          userId: auth.userId,
          action: "otp_viewed",
          outcome: "success",
          ipAddress: ip,
        })),
      })
      .catch(() => {});

    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
