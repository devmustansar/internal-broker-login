import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-helpers";
import { canManageOrg, isSuperAdmin } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/2fa/[id]/access-log
 * Returns the access log for an entry, sorted newest-first.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await params;
    const entry = await prisma.twoFactorEntry.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!entry) return notFound("2FA entry not found");
    if (!isSuperAdmin(auth) && !canManageOrg(auth, entry.organizationId)) {
      return forbidden();
    }

    const logs = await prisma.twoFactorAccessLog.findMany({
      where: { twoFactorEntryId: id },
      select: {
        id: true,
        action: true,
        outcome: true,
        ipAddress: true,
        userAgent: true,
        timestamp: true,
        details: true,
        userId: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 200,
    });

    return NextResponse.json(logs);
  } catch (err) {
    return serverError(err);
  }
}
