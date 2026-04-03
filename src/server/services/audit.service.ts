import type { AuditLog, AuditAction } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ─── In-Memory Audit Store (extend to Redis/DB for production) ────────────────

const auditLogs: AuditLog[] = [];

interface LogParams {
  action: AuditAction;
  internalUserId: string;
  resourceKey?: string;
  brokerSessionId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  outcome: AuditLog["outcome"];
}

export const auditLogService = {
  log(params: LogParams): void {
    const entry: AuditLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...params,
    };
    auditLogs.push(entry);
    // Console output for POC visibility
    const icon =
      params.outcome === "success" ? "✅" : params.outcome === "failure" ? "❌" : "ℹ️";
    console.log(
      `[AUDIT] ${icon} ${params.action} | user=${params.internalUserId} | resource=${params.resourceKey ?? "-"} | session=${params.brokerSessionId ?? "-"}`
    );
  },

  getByUser(internalUserId: string): AuditLog[] {
    return [...auditLogs].filter((l) => l.internalUserId === internalUserId);
  },

  getBySession(brokerSessionId: string): AuditLog[] {
    return [...auditLogs].filter((l) => l.brokerSessionId === brokerSessionId);
  },

  getAll(): AuditLog[] {
    return [...auditLogs].reverse(); // newest first
  },
};
