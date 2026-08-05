import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/server/secrets/encryption";
import { logPersonalVaultAction } from "@/server/services/personal-vault.service";

const VALID_ALGORITHMS = ["SHA1", "SHA256", "SHA512"];
const VALID_DIGITS = [6, 8];
const VALID_PERIODS = [30, 60];

type Params = { params: Promise<{ id: string }> };

const ENTRY_SELECT = {
  id: true, appName: true, issuer: true, accountLabel: true,
  algorithm: true, digits: true, period: true, notes: true,
  createdAt: true, updatedAt: true,
};

/**
 * GET /api/personal-vault/totp/[id]
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const entry = await prisma.personalTwoFactorEntry.findFirst({
      where: { id, ownerUserId: auth.userId, deletedAt: null },
      select: ENTRY_SELECT,
    });
    if (!entry) return notFound("2FA entry not found");

    return NextResponse.json(entry);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PATCH /api/personal-vault/totp/[id]
 * Passing newSecret rotates the secret and archives the old version.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.personalTwoFactorEntry.findFirst({ where: { id, ownerUserId: auth.userId, deletedAt: null } });
    if (!existing) return notFound("2FA entry not found");

    const body = await req.json();
    const updateData: any = {};

    if (body.appName !== undefined) updateData.appName = body.appName.trim();
    if (body.issuer !== undefined) updateData.issuer = body.issuer;
    if (body.accountLabel !== undefined) updateData.accountLabel = body.accountLabel;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.algorithm !== undefined) {
      const algorithm = body.algorithm.toUpperCase();
      if (!VALID_ALGORITHMS.includes(algorithm)) return badRequest(`algorithm must be one of: ${VALID_ALGORITHMS.join(", ")}`);
      updateData.algorithm = algorithm;
    }
    if (body.digits !== undefined) {
      const digits = parseInt(body.digits, 10);
      if (!VALID_DIGITS.includes(digits)) return badRequest("digits must be 6 or 8");
      updateData.digits = digits;
    }
    if (body.period !== undefined) {
      const period = parseInt(body.period, 10);
      if (!VALID_PERIODS.includes(period)) return badRequest("period must be 30 or 60");
      updateData.period = period;
    }

    let secretRotated = false;
    if (body.newSecret) {
      const clean = body.newSecret.toUpperCase().replace(/\s/g, "");
      if (!/^[A-Z2-7]+=*$/i.test(clean)) return badRequest("Invalid Base32 secret");

      const versions = await prisma.personalTwoFactorSecretVersion.count({ where: { entryId: id } });
      await prisma.personalTwoFactorSecretVersion.create({
        data: {
          entryId: id,
          encryptedSecret: existing.encryptedSecret,
          version: versions + 1,
          rotatedById: auth.userId,
        },
      });

      updateData.encryptedSecret = encrypt(clean);
      secretRotated = true;
    }

    const updated = await prisma.personalTwoFactorEntry.update({
      where: { id },
      data: updateData,
      select: ENTRY_SELECT,
    });

    await logPersonalVaultAction({
      userId: auth.userId,
      action: secretRotated ? "2fa_secret_rotated" : "2fa_updated",
      targetType: "2fa",
      targetId: id,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/personal-vault/totp/[id]
 * Soft-delete.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.personalTwoFactorEntry.findFirst({ where: { id, ownerUserId: auth.userId, deletedAt: null } });
    if (!existing) return notFound("2FA entry not found");

    await prisma.personalTwoFactorEntry.update({ where: { id }, data: { deletedAt: new Date() } });

    await logPersonalVaultAction({
      userId: auth.userId,
      action: "2fa_deleted",
      targetType: "2fa",
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
