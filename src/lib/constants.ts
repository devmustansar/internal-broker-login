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

// Credential Vault Strings
export const STR_CRED_TAB_LABEL = "CREDENTIALS";
export const STR_CRED_PANEL_TITLE = "Credential Vault";
export const STR_CRED_ALL = "All Credentials";
export const STR_CRED_GROUPS = "Groups";
export const STR_CRED_ADD = "Add Credential";
export const STR_CRED_ADD_SUCCESS = "Credential created successfully!";
export const STR_CRED_UPDATE_SUCCESS = "Credential updated successfully!";
export const STR_CRED_DELETE_SUCCESS = "Credential deleted successfully!";
export const STR_CRED_SHARE_SUCCESS = "Credential shared successfully!";
export const STR_CRED_UNSHARE_SUCCESS = "Share revoked.";
export const STR_CRED_GROUP_CREATE_SUCCESS = "Group created successfully!";
export const STR_CRED_GROUP_DELETE_SUCCESS = "Group deleted successfully!";
export const STR_CRED_GROUP_MEMBER_ADD_SUCCESS = "Member added to group.";
export const STR_CRED_GROUP_MEMBER_REMOVE_SUCCESS = "Member removed from group.";
export const STR_CRED_GROUP_CRED_ADD_SUCCESS = "Credential added to group.";
export const STR_CRED_GROUP_CRED_REMOVE_SUCCESS = "Credential removed from group.";
export const STR_CRED_NO_RESULTS = "No credentials found.";
export const STR_CRED_NO_GROUPS = "No groups created yet.";
export const STR_CRED_SEARCH_PLACEHOLDER = "Search credentials...";
export const STR_CRED_SHARED_TITLE = "Shared Credentials";
export const STR_CRED_SHARED_EMPTY = "No credentials have been shared with you yet.";
export const STR_CRED_COPIED = "Copied to clipboard!";

