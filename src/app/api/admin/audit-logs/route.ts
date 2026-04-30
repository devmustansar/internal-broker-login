import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, getOrgFilter } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/audit-logs
 *
 * Query params (all optional):
 *   userId        — filter by internal user ID
 *   organizationId — filter by org; super_admin can query any org, admin only their own
 *   action        — filter by AuditAction string
 *   outcome       — "success" | "failure" | "info"
 *   resourceKey   — filter by resource key
 *   dateFrom      — ISO timestamp (inclusive)
 *   dateTo        — ISO timestamp (inclusive)
 *   limit         — max rows (default 100, max 500)
 *   offset        — pagination offset (default 0)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const { searchParams } = new URL(req.url);

    const userId       = searchParams.get("userId")        || undefined;
    const orgId        = searchParams.get("organizationId") || undefined;
    const action       = searchParams.get("action")        || undefined;
    const outcome      = searchParams.get("outcome")       || undefined;
    const resourceKey  = searchParams.get("resourceKey")   || undefined;
    const dateFrom     = searchParams.get("dateFrom")      || undefined;
    const dateTo       = searchParams.get("dateTo")        || undefined;
    const limit        = Math.min(parseInt(searchParams.get("limit")  || "100", 10), 500);
    const offset       = parseInt(searchParams.get("offset") || "0", 10);

    // Org scope enforcement: admins can only see their own orgs' logs
    const orgFilter = getOrgFilter(auth); // { organizationId: { in: [...] } } or {}
    const effectiveOrgId = orgId ?? (orgFilter as any)?.organizationId?.in?.[0] ?? undefined;

    // Build where clause
    const where: any = {
      // If there's an org scope from the JWT, enforce it
      ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      // For non-super-admins, restrict to their orgs even without explicit filter
      ...(auth.role !== "super_admin" && (orgFilter as any)?.organizationId
        ? { organizationId: { in: (orgFilter as any).organizationId.in } }
        : {}),
    };

    if (userId)      where.userId      = userId;
    if (action)      where.action      = action;
    if (outcome)     where.outcome     = outcome;
    if (resourceKey) where.resourceKey = resourceKey;

    if (dateFrom || dateTo) {
      where.timestamp = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, limit, offset });
  } catch (err) {
    return serverError(err);
  }
}
