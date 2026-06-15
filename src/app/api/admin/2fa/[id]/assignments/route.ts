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
import { logManagementAction } from "@/server/services/two-factor.service";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/2fa/[id]/assignments
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const entry = await prisma.twoFactorEntry.findUnique({
      where: { id, deletedAt: null },
      select: { organizationId: true },
    });
    if (!entry) return notFound("2FA entry not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, entry.organizationId)) {
      return forbidden();
    }

    const assignments = await prisma.twoFactorAssignment.findMany({
      where: { twoFactorEntryId: id },
      select: {
        id: true,
        assignedToUserId: true,
        assignedById: true,
        createdAt: true,
        assignedToUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(assignments);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/admin/2fa/[id]/assignments
 * { userIds: string[] }  — idempotent bulk assign
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const entry = await prisma.twoFactorEntry.findUnique({
      where: { id, deletedAt: null },
      select: { organizationId: true, appName: true },
    });
    if (!entry) return notFound("2FA entry not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, entry.organizationId)) {
      return forbidden();
    }

    const body = await req.json();
    const userIds: string[] = body.userIds;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return badRequest("userIds must be a non-empty array");
    }

    const existing = await prisma.twoFactorAssignment.findMany({
      where: { twoFactorEntryId: id, assignedToUserId: { in: userIds } },
      select: { assignedToUserId: true },
    });
    const alreadyAssigned = new Set(existing.map((a) => a.assignedToUserId));
    const toCreate = userIds.filter((uid) => !alreadyAssigned.has(uid));

    if (toCreate.length > 0) {
      await prisma.twoFactorAssignment.createMany({
        data: toCreate.map((uid) => ({
          organizationId: entry.organizationId,
          twoFactorEntryId: id,
          assignedToUserId: uid,
          assignedById: auth.userId,
        })),
      });

      await logManagementAction({
        action: "2fa_assigned",
        userId: auth.userId,
        organizationId: entry.organizationId,
        details: {
          entryId: id,
          appName: entry.appName,
          assignedToUserIds: toCreate,
          count: toCreate.length,
        },
      });
    }

    return NextResponse.json({ created: toCreate.length, skipped: alreadyAssigned.size });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/2fa/[id]/assignments
 * { userIds: string[] }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const entry = await prisma.twoFactorEntry.findUnique({
      where: { id, deletedAt: null },
      select: { organizationId: true, appName: true },
    });
    if (!entry) return notFound("2FA entry not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, entry.organizationId)) {
      return forbidden();
    }

    const body = await req.json();
    const userIds: string[] = body.userIds;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return badRequest("userIds must be a non-empty array");
    }

    const result = await prisma.twoFactorAssignment.deleteMany({
      where: { twoFactorEntryId: id, assignedToUserId: { in: userIds } },
    });

    await logManagementAction({
      action: "2fa_unassigned",
      userId: auth.userId,
      organizationId: entry.organizationId,
      details: {
        entryId: id,
        appName: entry.appName,
        removedUserIds: userIds,
        count: result.count,
      },
    });

    return NextResponse.json({ removed: result.count });
  } catch (err) {
    return serverError(err);
  }
}
