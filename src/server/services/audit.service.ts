import type { AuditAction } from "@/types";
import { prisma } from "@/lib/prisma";

// ─── Audit Log Service ────────────────────────────────────────────────────────
//
// Persists every audit event to the AuditLog table in the database.
// The log() call is fire-and-forget (never awaited) so it never blocks
// the request that emits it.  Failures are caught and logged to console only.
//
// organizationId resolution strategy:
//   1. Use explicitly passed organizationId (if provided by caller)
//   2. Look up the resource by resourceKey → take its organizationId  (auto)
//   3. Look up the user by userId → take their organizationId        (auto, fallback)
//   4. Leave null if none of the above resolves

interface LogParams {
  action: AuditAction;
  internalUserId: string;
  resourceKey?: string;
  brokerSessionId?: string;
  /** Optional: if not supplied, resolved automatically from the resource or user */
  organizationId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  outcome: "success" | "failure" | "info";
}

export const auditLogService = {
  /**
   * Persist an audit event.  Fire-and-forget — never throws.
   */
  log(params: LogParams): void {
    const icon =
      params.outcome === "success" ? "✅"
      : params.outcome === "failure" ? "❌"
      : "ℹ️";

    console.log(
      `[AUDIT] ${icon} ${params.action} | user=${params.internalUserId} | resource=${params.resourceKey ?? "-"} | session=${params.brokerSessionId ?? "-"}`
    );

    // Async persist — do NOT await, never block the caller
    (async () => {
      try {
        let resolvedOrgId = params.organizationId ?? null;

        // Auto-resolve organizationId if not explicitly supplied
        if (!resolvedOrgId) {
          // Strategy 1: resource's organizationId (most reliable for app events)
          if (params.resourceKey) {
            const resource = await prisma.resource.findFirst({
              where: { resourceKey: params.resourceKey },
              select: { organizationId: true },
            });
            resolvedOrgId = resource?.organizationId ?? null;
          }

          // Strategy 2: user's first org via UserOrganization join table (fallback)
          if (!resolvedOrgId && params.internalUserId) {
            const userOrg = await (prisma as any).userOrganization.findFirst({
              where: { userId: params.internalUserId },
              select: { organizationId: true },
            });
            resolvedOrgId = userOrg?.organizationId ?? null;
          }
        }

        await prisma.auditLog.create({
          data: {
            action:          params.action,
            userId:          params.internalUserId || null,
            resourceKey:     params.resourceKey    || null,
            organizationId:  resolvedOrgId,
            brokerSessionId: params.brokerSessionId || null,
            outcome:         params.outcome,
            details:         (params.details as any) || null,
            ipAddress:       params.ipAddress || null,
          },
        });
      } catch (err) {
        // Never surface DB errors to the caller — audit must not break the flow
        console.error("[AUDIT] Failed to persist audit log to DB:", err);
      }
    })();
  },
};
