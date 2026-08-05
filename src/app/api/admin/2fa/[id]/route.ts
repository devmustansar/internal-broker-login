import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { canEditTwoFactorEntry } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import {
  encryptSecret,
  logManagementAction,
} from "@/server/services/two-factor.service";

const VALID_ALGORITHMS = ["SHA1", "SHA256", "SHA512"];
const VALID_DIGITS = [6, 8];
const VALID_PERIODS = [30, 60];

type Params = { params: Promise<{ id: string }> };

/** Loads the entry plus owner ids of any linked resource, for canEditTwoFactorEntry checks. */
async function loadEntryWithLinkedOwners(id: string) {
  return prisma.twoFactorEntry.findUnique({
    where: { id, deletedAt: null },
    include: {
      resource: { select: { ownerUserId: true } },
      awsResource: { select: { ownerUserId: true } },
    },
  });
}

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
  resourceId: true,
  awsResourceId: true,
  credentialId: true,
  resource: { select: { id: true, name: true, resourceKey: true } },
  awsResource: { select: { id: true, name: true, resourceKey: true } },
  credential: { select: { id: true, appName: true } },
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
    const linkedOwners = await loadEntryWithLinkedOwners(id);
    if (!canEditTwoFactorEntry(auth, entry, linkedOwners?.resource?.ownerUserId, linkedOwners?.awsResource?.ownerUserId)) {
      return forbidden();
    }

    return NextResponse.json({
      ...entry,
      canEdit: canEditTwoFactorEntry(auth, entry, linkedOwners?.resource?.ownerUserId, linkedOwners?.awsResource?.ownerUserId),
    });
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
    const existing = await loadEntryWithLinkedOwners(id);
    if (!existing) return notFound("2FA entry not found");
    if (!canEditTwoFactorEntry(auth, existing, existing.resource?.ownerUserId, existing.awsResource?.ownerUserId)) {
      return forbidden();
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.appName !== undefined) updateData.appName = body.appName.trim();
    if (body.issuer !== undefined) updateData.issuer = body.issuer;
    if (body.accountLabel !== undefined) updateData.accountLabel = body.accountLabel;
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
    if (body.category !== undefined) updateData.category = body.category;
    if (body.environment !== undefined) updateData.environment = body.environment;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.allowNotesForUsers !== undefined) updateData.allowNotesForUsers = body.allowNotesForUsers;
    if ("resourceId" in body) updateData.resourceId = body.resourceId ?? null;
    if ("awsResourceId" in body) updateData.awsResourceId = body.awsResourceId ?? null;
    if ("credentialId" in body) updateData.credentialId = body.credentialId ?? null;
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
    const existing = await loadEntryWithLinkedOwners(id);
    if (!existing) return notFound("2FA entry not found");
    if (!canEditTwoFactorEntry(auth, existing, existing.resource?.ownerUserId, existing.awsResource?.ownerUserId)) {
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
