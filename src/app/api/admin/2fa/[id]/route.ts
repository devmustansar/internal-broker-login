import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { canManageOrg, isSuperAdmin } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import {
  encryptSecret,
  decryptSecret,
  logManagementAction,
} from "@/server/services/two-factor.service";

type Params = { params: Promise<{ id: string }> };

const ENTRY_SELECT = {
  id: true,
  appName: true,
  issuer: true,
  accountLabel: true,
  algorithm: true,
  digits: true,
  period: true,
  category: true,
  environment: true,
  notes: true,
  allowNotesForUsers: true,
  status: true,
  organizationId: true,
  createdById: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * GET /api/admin/2fa/[id]
 * Full entry detail including assignments.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const entry = await prisma.twoFactorEntry.findUnique({
      where: { id, deletedAt: null },
      select: {
        ...ENTRY_SELECT,
        assignments: {
          select: {
            id: true,
            assignedToUserId: true,
            assignedById: true,
            createdAt: true,
            assignedToUser: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!entry) return notFound("2FA entry not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, entry.organizationId)) {
      return forbidden();
    }

    return NextResponse.json(entry);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PATCH /api/admin/2fa/[id]
 * Update metadata. Passing newSecret rotates the secret and archives the old version.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.twoFactorEntry.findUnique({
      where: { id, deletedAt: null },
    });
    if (!existing) return notFound("2FA entry not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, existing.organizationId)) {
      return forbidden();
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.appName !== undefined) updateData.appName = body.appName.trim();
    if (body.issuer !== undefined) updateData.issuer = body.issuer;
    if (body.accountLabel !== undefined) updateData.accountLabel = body.accountLabel;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.environment !== undefined) updateData.environment = body.environment;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.allowNotesForUsers !== undefined) updateData.allowNotesForUsers = body.allowNotesForUsers;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "disabled") {
        await logManagementAction({
          action: "2fa_entry_disabled",
          userId: auth.userId,
          organizationId: existing.organizationId,
          details: { entryId: id, appName: existing.appName },
        });
      }
    }

    if (body.newSecret) {
      const clean = body.newSecret.toUpperCase().replace(/\s/g, "");
      if (!/^[A-Z2-7]+=*$/i.test(clean)) return badRequest("Invalid Base32 secret");

      const versions = await prisma.twoFactorSecretVersion.count({
        where: { twoFactorEntryId: id },
      });

      await prisma.twoFactorSecretVersion.create({
        data: {
          twoFactorEntryId: id,
          encryptedSecret: existing.encryptedSecret,
          version: versions + 1,
          rotatedById: auth.userId,
        },
      });

      updateData.encryptedSecret = encryptSecret(clean);

      await logManagementAction({
        action: "2fa_secret_rotated",
        userId: auth.userId,
        organizationId: existing.organizationId,
        details: { entryId: id, version: versions + 1 },
      });
    }

    const updated = await prisma.twoFactorEntry.update({
      where: { id },
      data: updateData,
      select: ENTRY_SELECT,
    });

    await logManagementAction({
      action: "2fa_entry_updated",
      userId: auth.userId,
      organizationId: existing.organizationId,
      details: { entryId: id },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/2fa/[id]
 * Soft-delete.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const existing = await prisma.twoFactorEntry.findUnique({
      where: { id, deletedAt: null },
    });
    if (!existing) return notFound("2FA entry not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, existing.organizationId)) {
      return forbidden();
    }

    await prisma.twoFactorEntry.update({
      where: { id },
      data: { deletedAt: new Date(), status: "disabled" },
    });

    await logManagementAction({
      action: "2fa_entry_deleted",
      userId: auth.userId,
      organizationId: existing.organizationId,
      details: { entryId: id, appName: existing.appName },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
