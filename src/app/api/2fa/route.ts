import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/2fa
 * Returns all 2FA entries assigned to the authenticated user.
 * Never returns encrypted secrets.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const assignments = await prisma.twoFactorAssignment.findMany({
      where: {
        assignedToUserId: auth.userId,
        entry: { deletedAt: null, status: "active" },
      },
      select: {
        id: true,
        createdAt: true,
        entry: {
          select: {
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
            organizationId: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = assignments.map(({ id: assignmentId, createdAt: assignedAt, entry }) => ({
      assignmentId,
      assignedAt,
      ...entry,
      notes: entry.allowNotesForUsers ? entry.notes : null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
