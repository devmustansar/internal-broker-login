// ─── Core Domain Types ───────────────────────────────────────────────────────

export interface InternalUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user" | "readonly";
  allowedResourceKeys: string[]; // '*' means all
  createdAt: string;
}

export interface Resource {
  id: string;
  resourceKey: string; // e.g. "client-app-prod"
  name: string;
  appHost: string; // e.g. "https://app.client.com"
  apiHost: string; // e.g. "https://api.client.com"
  loginUrl: string; // e.g. "https://api.client.com/auth/broker-login" — client backend endpoint that validates credentials and returns a one-time token
  loginMethod: "POST" | "GET";
  loginAdapter: "form_login_basic" | "form_login_csrf" | "json_login";
  tokenExtractionPath?: string | null; // JSON path to extract the one-time token from the login response
  tokenValidationPath?: string | null; // e.g. "/auth/validate" — client app path that accepts ?token=<one-time-token>
  usernameField?: string | null;
  passwordField?: string | null;
  environment: "production" | "staging" | "development";
  isActive: boolean;
  description?: string;
  iconUrl?: string;
}

export interface ManagedAccount {
  id: string;
  resourceId: string;
  accountKey: string; // e.g. "svc-broker-prod"
  vaultPath: string; // e.g. "secret/data/client-app/broker-account"
  label: string; // human-readable label
  role: "service" | "admin" | "readonly";
  isActive: boolean;
}

export type BrokerSessionStatus =
  | "active"
  | "expired"
  | "ended"
  | "failed"
  | "pending";

export interface BrokerSession {
  brokerSessionId: string;
  internalUserId: string;
  resourceKey: string;
  managedAccountKey: string;
  upstreamCookies: Record<string, string>;
  expiresAt: string; // ISO
  createdAt: string; // ISO
  status: BrokerSessionStatus;
  appHost: string;
  apiHost: string;
  metadata?: Record<string, unknown>;
}

export type AuditAction =
  | "user_login"
  | "user_logout"
  | "app_open_attempt"
  | "access_granted"
  | "access_denied"
  | "broker_session_created"
  | "broker_session_ended"
  | "vault_credential_fetched"
  | "upstream_login_success"
  | "upstream_login_failed"
  | "one_time_token_issued"
  | "one_time_token_failed"
  | "redirect_url_issued";

export interface AuditLog {
  id: string;
  action: AuditAction;
  internalUserId: string;
  resourceKey?: string;
  brokerSessionId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  outcome: "success" | "failure" | "info";
}

// ─── Vault ───────────────────────────────────────────────────────────────────

export interface VaultCredential {
  email: string;
  password: string;
  loginType: string; // e.g. "password", "token"
  extra?: Record<string, string>;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export interface AdapterLoginResult {
  success: boolean;
  upstreamCookies: Record<string, string>;
  statusCode?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface MockLoginRequest {
  email: string;
  password: string;
}

export interface MockLoginResponse {
  token: string;
  user: InternalUser;
}

export interface OpenAppRequest {
  resourceKey: string;
  deviceId?: string;
  browser?: string;
}

export interface OpenAppResponse {
  brokerSessionId: string;
  resourceKey: string;
  appHost: string;
  apiHost: string;
  expiresAt: string;
  status: BrokerSessionStatus;
  /** Full redirect URL to send the browser to — includes the one-time token in the query string */
  redirectUrl?: string;
  /** @deprecated Legacy proxy handoff token — replaced by redirectUrl in the new flow */
  handoffToken?: string;
}

// ─── Auth Context (stored in JWT / cookie) ────────────────────────────────────

export interface AuthContext {
  userId: string;
  email: string;
  role: InternalUser["role"];
  iat?: number;
  exp?: number;
}
