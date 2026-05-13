// ─── Core Domain Types ───────────────────────────────────────────────────────

export interface InternalUser {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "user" | "readonly";
  createdAt: string;
}

export type OrgRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Resource {
  id: string;
  resourceKey: string; // e.g. "client-app-prod"
  name: string;
  appHost: string; // e.g. "https://app.client.com"
  apiHost: string; // e.g. "https://api.client.com"
  loginUrl: string; // e.g. "https://api.client.com/auth/broker-login"
  loginMethod: "POST" | "GET";
  loginAdapter: "form_login_basic" | "form_login_csrf" | "json_login" | "magic_link";
  tokenExtractionPath?: string | null;
  tokenValidationPath?: string | null;
  /**
   * For magic_link adapter: JSON dot-path to the redirect URL in the login response.
   * e.g. "data.url", "link", "redirectTo".
   * The broker will redirect the user directly to this URL, bypassing tokenValidationPath.
   */
  magicLinkExtractionPath?: string | null;
  /**
   * Optional JSON template for the login request body.
   * Supports {{email}} and {{password}} placeholders — replaced at runtime with vault credentials.
   * Any extra static fields and nesting in the template are preserved.
   * Example: {"user_params":{"email":"{{email}}","password":"{{password}}","external_login_url":true}}
   * When null/undefined, the broker falls back to a flat { [usernameField]: email, [passwordField]: password } body.
   */
  loginPayloadTemplate?: string | null;
  usernameField?: string | null;
  passwordField?: string | null;
  environment: "production" | "staging" | "development";
  isActive: boolean;
  description?: string;
  iconUrl?: string;
  organizationId?: string | null;
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
  resourceId: string;
  resourceKey?: string; // derived from relation for display
  managedAccountKey: string;
  upstreamCookies: Record<string, string>;
  expiresAt: string; // ISO
  createdAt: string; // ISO
  status: BrokerSessionStatus;
  appHost: string;
  apiHost: string;
  metadata?: Record<string, unknown>;
}

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
  /** For magic_link adapters: the full redirect URL extracted from the login response. */
  redirectUrl?: string;
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
  organizationIds: string[];
  /** Per-org role mappings — { orgId: "owner" | "admin" | "member" } */
  orgRoles: Record<string, OrgRole>;
  iat?: number;
  exp?: number;
}

// ─── AWS Federation ───────────────────────────────────────────────────────────

/**
 * Stored in the DB AwsResource.config JSON column.
 * All durations are in seconds unless noted.
 */
export interface AwsResourceConfig {
  /** AWS account ID, e.g. "123456789012" */
  awsAccountId: string;
  /** IAM Role ARN to assume, e.g. "arn:aws:iam::123456789012:role/BrokerConsoleRole" */
  roleArn: string;
  /** AWS region for the console destination, e.g. "us-east-1" */
  region: string;
  /**
   * Console destination URL after login.
   * Must be an allowed AWS console URL (allowlisted in aws-federation.service.ts).
   * e.g. "https://console.aws.amazon.com/ec2/v2/home"
   */
  destination: string;
  /** Issuer label shown in CloudTrail, e.g. "internal-broker" */
  issuer: string;
  /** STS session duration in seconds. Min 900, max 43200. Default 3600. */
  sessionDurationSeconds: number;
  /** External ID for cross-account role trust policy (optional) */
  externalId?: string;
  /**
   * Legacy reference key for broker credentials. Now auto-derived as aws/resource/{resourceKey}.
   * Kept for backward compatibility with records created before per-resource credential scoping.
   */
  brokerCredentialRef?: string;
  /**
   * Which STS strategy to use.
   * "assume_role" — preferred; broker IAM user assumes target IAM role.
   * "federation_token" — fallback; uses broker credentials directly (less secure).
   */
  stsStrategy: "assume_role" | "federation_token";
  /**
   * Optional fixed STS session name used in CloudTrail for all users of this resource.
   * When set, overrides the default behaviour of using the authenticated user's email.
   * Useful for resources where the same service-account identity is always shown in CloudTrail.
   * Must match STS RoleSessionName constraints: [a-zA-Z0-9+=,.@_-], max 64 chars.
   */
  sessionName?: string;
  /**
   * IAM managed policy ARNs to attach as session policies.
   * These scope down the assumed role's permissions for this specific session.
   * Populated per-user from the UserAwsPolicy table at launch time.
   */
  policyArns?: string[];
}

/**
 * Broker's own AWS credentials, loaded from SecretsProvider.
 * These are the long-lived IAM credentials that the broker uses to call STS.
 * In production, these come from HashiCorp Vault.
 * In dev/POC, they come from DummyVaultSecretsProvider.
 */
export interface AwsBrokerCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional — only needed if broker itself uses a temporary credential (e.g. broker-on-EC2 w/ assumed role) */
  sessionToken?: string;
}

/**
 * Temporary AWS credentials obtained from STS (AssumeRole or GetFederationToken).
 * These are passed to the AWS federation endpoint.
 */
export interface AwsTemporaryCredentials {
  sessionId: string;    // maps to Credentials.AccessKeyId
  sessionKey: string;   // maps to Credentials.SecretAccessKey
  sessionToken: string; // maps to Credentials.SessionToken
  expiration: Date;
}

/**
 * Final result of the AWS federation flow.
 */
export interface AwsFederationResult {
  /** The full AWS console sign-in URL with the SigninToken embedded */
  loginUrl: string;
  /** ISO timestamp when the temporary credentials expire */
  expiresAt: string;
  /** The AWS account ID for audit logging */
  awsAccountId: string;
  /** The role ARN that was assumed */
  roleArn: string;
}

/**
 * Audit event payload for AWS federation launches.
 * Extends base audit log with AWS-specific fields.
 */
export interface AwsAuditDetails {
  awsAccountId: string;
  roleArn: string;
  region: string;
  stsStrategy: string;
  sessionDuration: number;
  destination: string;
  ipAddress?: string;
  userAgent?: string;
  brokerCredentialRef?: string;
  expiresAt?: string;
  error?: string;
}

// Extend AuditAction with AWS-specific entries
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
  | "redirect_url_issued"
  // ─── AWS Federation ─────────────────────────────────────────────────────────
  | "aws_launch_attempt"
  | "aws_secrets_loaded"
  | "aws_secrets_failed"
  | "aws_sts_success"
  | "aws_sts_failed"
  | "aws_signin_token_obtained"
  | "aws_signin_token_failed"
  | "aws_console_redirect_issued"
  | "aws_entitlement_denied";

