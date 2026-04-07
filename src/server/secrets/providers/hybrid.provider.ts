// ─── HybridSecretsProvider ────────────────────────────────────────────────────
//
// Routes each secret operation to the correct backend based on the `provider`
// field stored on the StoredSecretRef table (or a hardcoded per-ref config map).
//
// Hybrid mode is for organisations migrating from DB → Vault incrementally:
//   - Old resources:   secretProvider = "database" → DatabaseSecretsProvider
//   - New resources:   secretProvider = "vault"    → VaultSecretsProvider
//   - Both coexist without any changes to business logic.
//
// Resolution order for getSecret():
//   1. Look up the SecretRef row to find which provider stores this ref
//   2. Delegate to the correct provider
//   3. Return the resolved secret (provider tag set to "database" or "vault")
//
// NOTE: HybridSecretsProvider itself does NOT store anything — it only routes.
//       The underlying providers handle all I/O.

import { prisma } from "@/lib/prisma";
import { DatabaseSecretsProvider } from "./database.provider";
import { VaultSecretsProvider } from "./vault.provider";
import {
  SecretNotFoundError,
  type SecretsProvider,
  type SecretKind,
  type SecretProviderType,
  type SaveSecretInput,
  type UpdateSecretInput,
  type ResolvedSecret,
} from "../types";

// ─── Provider instances ────────────────────────────────────────────────────────

// HybridSecretsProvider holds one instance of each concrete provider.
// Providers are lazy-initialized so VaultSecretsProvider doesn't throw at
// startup if VAULT_ADDR isn't set yet.

export class HybridSecretsProvider implements SecretsProvider {
  private _db: DatabaseSecretsProvider | null = null;
  private _vault: VaultSecretsProvider | null = null;

  private get db(): DatabaseSecretsProvider {
    if (!this._db) this._db = new DatabaseSecretsProvider();
    return this._db;
  }

  private get vault(): VaultSecretsProvider {
    if (!this._vault) this._vault = new VaultSecretsProvider();
    return this._vault;
  }

  // ── Routing ────────────────────────────────────────────────────────────────

  /**
   * Determine which provider a secretRef belongs to.
   * Looks it up in the SecretRef table (or falls back to "database").
   */
  private async resolveProvider(secretRef: string): Promise<SecretProviderType> {
    const ref = await prisma.storedSecretRef.findUnique({ where: { secretRef } });
    return (ref?.provider as SecretProviderType) ?? "database";
  }

  private providerFor(type: SecretProviderType): SecretsProvider {
    switch (type) {
      case "database": return this.db;
      case "vault":    return this.vault;
      default:
        throw new Error(`HybridSecretsProvider: unknown provider type '${type}'`);
    }
  }

  // ── SecretsProvider implementation ────────────────────────────────────────

  async getSecret<K extends SecretKind>(
    secretRef: string,
    kind: K
  ): Promise<ResolvedSecret<K>> {
    const providerType = await this.resolveProvider(secretRef);
    return this.providerFor(providerType).getSecret(secretRef, kind);
  }

  async hasSecret(secretRef: string): Promise<boolean> {
    const providerType = await this.resolveProvider(secretRef);
    return this.providerFor(providerType).hasSecret(secretRef);
  }

  async saveSecret<K extends SecretKind>(
    input: SaveSecretInput<K>
  ): Promise<ResolvedSecret<K>> {
    // The caller must specify which provider to use in hybrid mode.
    // Default to "database" if not specified.
    const providerType: SecretProviderType =
      (input.provider === "vault" || input.provider === "database")
        ? input.provider
        : "database";

    const result = await this.providerFor(providerType).saveSecret(input);

    // Register the secretRef → provider mapping so future reads route correctly.
    await prisma.storedSecretRef.upsert({
      where:  { secretRef: input.secretRef },
      create: { secretRef: input.secretRef, provider: providerType },
      update: { provider: providerType },
    });

    return result;
  }

  async updateSecret<K extends SecretKind>(
    secretRef: string,
    input: UpdateSecretInput<K>
  ): Promise<ResolvedSecret<K>> {
    const providerType = await this.resolveProvider(secretRef);
    return this.providerFor(providerType).updateSecret(secretRef, input);
  }

  async deleteSecret(secretRef: string): Promise<void> {
    const providerType = await this.resolveProvider(secretRef);
    await this.providerFor(providerType).deleteSecret(secretRef);
    // Mark the ref as deleted in the routing table
    await prisma.storedSecretRef.update({
      where: { secretRef },
      data:  { deletedAt: new Date() },
    });
  }

  async listSecrets(filter?: {
    resourceKey?: string;
    kind?: SecretKind;
  }): Promise<Omit<ResolvedSecret, "payload">[]> {
    // Gather from both providers and merge.
    // In practice you'd want pagination — this is a starting point.
    const [fromDb, fromVault] = await Promise.allSettled([
      this.db.listSecrets(filter),
      this.vault.listSecrets(filter).catch(() => [] as Omit<ResolvedSecret, "payload">[]),
    ]);

    const dbResults =
      fromDb.status === "fulfilled" ? fromDb.value : [];
    const vaultResults =
      fromVault.status === "fulfilled" ? fromVault.value : [];

    return [...dbResults, ...vaultResults];
  }
}
