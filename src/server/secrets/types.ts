// ─── Secret System Types ───────────────────────────────────────────────────────
//
// All code that reads/writes secrets depends ONLY on these types — never on
// Prisma models, Vault SDK types, or any provider-internal shapes.
// Business logic stays clean regardless of where secrets are stored.

// ─── Provider selection ────────────────────────────────────────────────────────

/**
 * Which backend stores a given secret.
 *
 * - `database`  — AES-256-GCM encrypted row in Postgres via Prisma
 * - `vault`     — HashiCorp Vault KV v2 (not yet implemented — stub ready)
 * - `hybrid`    — Per-secret routing; each secret specifies its own provider
 */
export type SecretProviderType = "database" | "vault" | "hybrid";

// ─── Secret kinds ──────────────────────────────────────────────────────────────

/**
 * Discriminated union of all recognised credential shapes.
 * Add new kinds here as the broker gains integrations.
 *
 * Naming convention: <vendor>_<auth-method>
 */
export type SecretKind =
  | "aws_iam_credentials"      // AWS IAM access key + secret
  | "web_basic_credentials"    // username + password for web apps (JSON/form login)
  | "jira_api_token"           // Jira/Atlassian cloud API token
  | "generic_key_value";       // Escape hatch — arbitrary key/value blob

// ─── Credential payloads (per kind) ───────────────────────────────────────────

export interface AwsIamCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** Present only for temporary credentials (e.g. broker runs on EC2 w/ assumed role) */
  sessionToken?: string;
}

export interface WebBasicCredentials {
  username: string;
  password: string;
  /** Optional extra fields (e.g. MFA OTP seed, custom headers) */
  extra?: Record<string, string>;
}

export interface JiraApiToken {
  /** The Atlassian account email associated with the token */
  email: string;
  apiToken: string;
}

export interface GenericKeyValue {
  [key: string]: string;
}

/** Map each SecretKind to its payload type (used in generic helpers) */
export interface SecretPayloadMap {
  aws_iam_credentials: AwsIamCredentials;
  web_basic_credentials: WebBasicCredentials;
  jira_api_token: JiraApiToken;
  generic_key_value: GenericKeyValue;
}

// ─── Core domain types ─────────────────────────────────────────────────────────

/**
 * Metadata stored alongside — but separately from — the encrypted payload.
 * All fields are safe to log; they must never contain plaintext secrets.
 */
export interface SecretMetadata {
  /** Human-readable label for UI/admin display */
  label?: string;
  /** Which resource this secret belongs to, e.g. "aws-prod-readonly" */
  resourceKey?: string;
  /** Free-form tags for search/filtering */
  tags?: string[];
  /** ISO timestamp of the last rotation */
  rotatedAt?: string;
  /** Arbitrary audit-safe notes */
  notes?: string;
}

/**
 * A resolved secret returned to callers.
 * The `payload` field contains the decrypted credential; treat it as sensitive.
 * Never serialize this object into HTTP responses or logs.
 */
export interface ResolvedSecret<K extends SecretKind = SecretKind> {
  /** Opaque identifier used to fetch/update/delete this secret */
  id: string;
  /** Logical reference key used in resource config, e.g. "aws/broker/default" */
  secretRef: string;
  kind: K;
  /** The actual decrypted credential payload */
  payload: SecretPayloadMap[K];
  metadata: SecretMetadata;
  /** Which provider resolved this secret */
  resolvedFrom: SecretProviderType;
  /** ISO creation timestamp */
  createdAt: string;
  /** ISO last-updated timestamp */
  updatedAt: string;
  /** Incremented on each update — supports optimistic concurrency */
  version: number;
}

// ─── Operation inputs ──────────────────────────────────────────────────────────

export interface SaveSecretInput<K extends SecretKind = SecretKind> {
  /** Logical reference key — must be unique per provider namespace */
  secretRef: string;
  kind: K;
  payload: SecretPayloadMap[K];
  metadata?: SecretMetadata;
  /** Which provider should store this secret (ignored in single-provider modes) */
  provider?: SecretProviderType;
}

export interface UpdateSecretInput<K extends SecretKind = SecretKind> {
  /** New payload to store — replaces the old one entirely */
  payload: SecretPayloadMap[K];
  /** Metadata changes are merged with existing metadata */
  metadata?: Partial<SecretMetadata>;
}

// ─── SecretsProvider interface ─────────────────────────────────────────────────

/**
 * The single abstraction all business logic depends on.
 *
 * Business services (broker, admin API) never import concrete providers.
 * They only import this interface.
 *
 * Implementations:
 *   - DatabaseSecretsProvider  (current — DB + AES-256-GCM)
 *   - VaultSecretsProvider     (TODO — HashiCorp Vault KV v2)
 *   - HybridSecretsProvider    (routes per-secret to the appropriate backend)
 */
export interface SecretsProvider {
  /**
   * Retrieve and decrypt a secret by its logical reference key.
   *
   * @param secretRef - e.g. "aws/broker/default" or "web/jira/prod"
   * @throws {SecretNotFoundError}   if the ref does not exist
   * @throws {SecretDecryptionError} if decryption fails (wrong key or corrupt data)
   */
  getSecret<K extends SecretKind>(
    secretRef: string,
    kind: K
  ): Promise<ResolvedSecret<K>>;

  /**
   * Persist a new secret.
   *
   * @throws {SecretAlreadyExistsError} if secretRef already exists in this provider
   */
  saveSecret<K extends SecretKind>(input: SaveSecretInput<K>): Promise<ResolvedSecret<K>>;

  /**
   * Update the payload (and optionally metadata) of an existing secret.
   * Increments the version counter.
   *
   * @throws {SecretNotFoundError} if secretRef does not exist
   */
  updateSecret<K extends SecretKind>(
    secretRef: string,
    input: UpdateSecretInput<K>
  ): Promise<ResolvedSecret<K>>;

  /**
   * Soft-delete a secret (marks it deleted; row stays for audit trail).
   *
   * @throws {SecretNotFoundError} if secretRef does not exist
   */
  deleteSecret(secretRef: string): Promise<void>;

  /**
   * Check whether a secret with this ref exists.
   * Cheaper than getSecret — does not decrypt.
   */
  hasSecret(secretRef: string): Promise<boolean>;

  /**
   * List summary info (no payloads) for all secrets (optional filter by resourceKey).
   * Used by admin UI / audit tools.
   */
  listSecrets(filter?: { resourceKey?: string; kind?: SecretKind }): Promise<
    Omit<ResolvedSecret, "payload">[]
  >;
}

// ─── Typed error classes ───────────────────────────────────────────────────────

export class SecretNotFoundError extends Error {
  constructor(secretRef: string) {
    super(`Secret not found: '${secretRef}'`);
    this.name = "SecretNotFoundError";
  }
}

export class SecretAlreadyExistsError extends Error {
  constructor(secretRef: string) {
    super(`Secret already exists: '${secretRef}'`);
    this.name = "SecretAlreadyExistsError";
  }
}

export class SecretDecryptionError extends Error {
  constructor(secretRef: string, cause?: unknown) {
    super(`Failed to decrypt secret '${secretRef}'`);
    this.name = "SecretDecryptionError";
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export class SecretEncryptionKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretEncryptionKeyError";
  }
}
