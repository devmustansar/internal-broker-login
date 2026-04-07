// ─── Secret Manager ───────────────────────────────────────────────────────────
//
// The ONLY export that business logic should ever import.
//
// Usage from any service:
//
//   import { secretManager } from "@/server/secrets/secret-manager";
//
// This module wires up the correct provider based on SECRET_PROVIDER env var:
//
//   SECRET_PROVIDER=database  → DatabaseSecretsProvider
//   SECRET_PROVIDER=vault     → VaultSecretsProvider
//   SECRET_PROVIDER=hybrid    → HybridSecretsProvider
//   (default)                 → DatabaseSecretsProvider
//
// Business logic never imports a concrete provider directly.

import { DatabaseSecretsProvider } from "./providers/database.provider";
import { VaultSecretsProvider }    from "./providers/vault.provider";
import { HybridSecretsProvider }   from "./providers/hybrid.provider";
import type { SecretsProvider, SecretProviderType } from "./types";

// Re-export types and errors so callers only need one import path
export type {
  SecretsProvider,
  SecretKind,
  SecretProviderType,
  ResolvedSecret,
  SaveSecretInput,
  UpdateSecretInput,
  SecretMetadata,
  AwsIamCredentials,
  WebBasicCredentials,
  JiraApiToken,
  GenericKeyValue,
} from "./types";

export {
  SecretNotFoundError,
  SecretAlreadyExistsError,
  SecretDecryptionError,
  SecretEncryptionKeyError,
} from "./types";

// ─── Factory ──────────────────────────────────────────────────────────────────

function createSecretManager(): SecretsProvider {
  const providerType = (process.env.SECRET_PROVIDER ?? "database") as SecretProviderType;

  switch (providerType) {
    case "database":
      return new DatabaseSecretsProvider();

    case "vault":
      // TODO: Remove this check when VaultSecretsProvider is fully implemented
      if (!process.env.VAULT_ADDR || !process.env.VAULT_TOKEN) {
        console.warn(
          "[SecretManager] SECRET_PROVIDER=vault but VAULT_ADDR/VAULT_TOKEN not set. " +
          "Falling back to database provider."
        );
        return new DatabaseSecretsProvider();
      }
      return new VaultSecretsProvider();

    case "hybrid":
      return new HybridSecretsProvider();

    default:
      throw new Error(
        `[SecretManager] Unknown SECRET_PROVIDER value: '${providerType}'. ` +
        "Valid values: database | vault | hybrid"
      );
  }
}

/**
 * Singleton secret manager for the process lifetime.
 * Import this in all services that need to read or write secrets.
 *
 * @example
 *   const secret = await secretManager.getSecret("aws/broker/default", "aws_iam_credentials");
 *   const creds = secret.payload; // AwsIamCredentials
 */
export const secretManager: SecretsProvider = createSecretManager();
