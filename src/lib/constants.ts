// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_TTL_SECONDS = 60 * 60; // 1 hour
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
export const JWT_EXPIRY = "8h";
export const BROKER_SESSION_PREFIX = "broker:session:";
export const AUDIT_LOG_PREFIX = "broker:audit:";
export const APP_NAME = "Internal Credentials Broker";
