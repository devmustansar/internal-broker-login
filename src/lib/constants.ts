// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_TTL_SECONDS = 60 * 60; // 1 hour
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
export const JWT_EXPIRY = "8h";
export const BROKER_SESSION_PREFIX = "broker:session:";
export const AUDIT_LOG_PREFIX = "broker:audit:";
export const APP_NAME = "CodingCops";
export const APP_DESCRIPTION = "Securely broker access to internal applications.";
export const APP_ADMIN_DESCRIPTION = "Manage applications and system settings.";

// App Card Strings
export const STR_AWS_TENANT = "AWS TENANT";
export const STR_AWS_FAIL_LAUNCH = "Failed to launch AWS Console";
export const STR_AWS_SUCCESS = "Federation established.";
export const STR_AWS_GENERATING = "Generating STS...";
export const STR_AWS_LAUNCH = "Federate Service Console";

export const STR_APP_FAIL_LAUNCH = "Failed to open app";
export const STR_APP_PROVISIONING = "Provisioning...";
export const STR_APP_LAUNCH = "Launch Handshake";
