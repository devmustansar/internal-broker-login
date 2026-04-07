// ─── SecretsAdminService ──────────────────────────────────────────────────────
//
// A thin service layer that wraps secretManager for admin and seeding operations.
// Business services should use secretManager directly for read operations.
// Admin API routes and seed scripts use this service for write operations.
//
// This layer adds:
//   - Audit logging around secret mutations
//   - Convenience typed save methods per SecretKind
//   - Upsert semantics (saveOrUpdate)

import { secretManager } from "@/server/secrets/secret-manager";
import {
  SecretAlreadyExistsError,
  SecretNotFoundError,
  type AwsIamCredentials,
  type WebBasicCredentials,
  type JiraApiToken,
  type SecretMetadata,
  type ResolvedSecret,
  type SecretKind,
} from "@/server/secrets/secret-manager";

// ─── Typed convenience methods ────────────────────────────────────────────────

export const secretsAdminService = {
  // ── AWS IAM ────────────────────────────────────────────────────────────────

  /**
   * Store AWS IAM broker credentials in the database (encrypted).
   *
   * @example
   *   await secretsAdminService.saveAwsCredentials("aws/broker/default", {
   *     accessKeyId: "AKIA...",
   *     secretAccessKey: "...",
   *   }, { resourceKey: "aws-prod-readonly", label: "Prod broker IAM key" });
   */
  async saveAwsCredentials(
    secretRef: string,
    creds: AwsIamCredentials,
    metadata: SecretMetadata = {}
  ): Promise<ResolvedSecret<"aws_iam_credentials">> {
    return secretManager.saveSecret({
      secretRef,
      kind: "aws_iam_credentials",
      payload: creds,
      metadata,
    });
  },

  async updateAwsCredentials(
    secretRef: string,
    creds: AwsIamCredentials,
    metadata?: Partial<SecretMetadata>
  ): Promise<ResolvedSecret<"aws_iam_credentials">> {
    return secretManager.updateSecret(secretRef, {
      payload: creds,
      metadata,
    });
  },

  // ── Web (JSON / form login) ────────────────────────────────────────────────

  /**
   * Store broker service account credentials for a web resource.
   *
   * @example
   *   await secretsAdminService.saveWebCredentials("web/jira/prod", {
   *     username: "svc-broker@company.com",
   *     password: "...",
   *   });
   */
  async saveWebCredentials(
    secretRef: string,
    creds: WebBasicCredentials,
    metadata: SecretMetadata = {}
  ): Promise<ResolvedSecret<"web_basic_credentials">> {
    return secretManager.saveSecret({
      secretRef,
      kind: "web_basic_credentials",
      payload: creds,
      metadata,
    });
  },

  async updateWebCredentials(
    secretRef: string,
    creds: WebBasicCredentials,
    metadata?: Partial<SecretMetadata>
  ): Promise<ResolvedSecret<"web_basic_credentials">> {
    return secretManager.updateSecret(secretRef, {
      payload: creds,
      metadata,
    });
  },

  // ── Jira / Atlassian ───────────────────────────────────────────────────────

  async saveJiraToken(
    secretRef: string,
    token: JiraApiToken,
    metadata: SecretMetadata = {}
  ): Promise<ResolvedSecret<"jira_api_token">> {
    return secretManager.saveSecret({
      secretRef,
      kind: "jira_api_token",
      payload: token,
      metadata,
    });
  },

  // ── Upsert (idempotent seeding) ────────────────────────────────────────────

  /**
   * Save or update a secret — safe to call in seed scripts.
   * If the secretRef already exists, it is updated. Otherwise created.
   */
  async saveOrUpdateAwsCredentials(
    secretRef: string,
    creds: AwsIamCredentials,
    metadata: SecretMetadata = {}
  ): Promise<ResolvedSecret<"aws_iam_credentials">> {
    const exists = await secretManager.hasSecret(secretRef);
    if (exists) {
      return secretManager.updateSecret(secretRef, { payload: creds, metadata });
    }
    return secretManager.saveSecret({
      secretRef,
      kind: "aws_iam_credentials",
      payload: creds,
      metadata,
    });
  },

  async saveOrUpdateWebCredentials(
    secretRef: string,
    creds: WebBasicCredentials,
    metadata: SecretMetadata = {}
  ): Promise<ResolvedSecret<"web_basic_credentials">> {
    const exists = await secretManager.hasSecret(secretRef);
    if (exists) {
      return secretManager.updateSecret(secretRef, { payload: creds, metadata });
    }
    return secretManager.saveSecret({
      secretRef,
      kind: "web_basic_credentials",
      payload: creds,
      metadata,
    });
  },

  // ── Delete ─────────────────────────────────────────────────────────────────

  async deleteSecret(secretRef: string): Promise<void> {
    return secretManager.deleteSecret(secretRef);
  },

  // ── List (admin UI) ────────────────────────────────────────────────────────

  async listSecrets(filter?: {
    resourceKey?: string;
    kind?: SecretKind;
  }): Promise<Omit<ResolvedSecret, "payload">[]> {
    return secretManager.listSecrets(filter);
  },
};
