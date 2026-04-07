// ─── VaultSecretsProvider — HashiCorp Vault KV v2 (STUB) ──────────────────────
//
// This file is the designated landing zone for the real Vault implementation.
// It implements the same SecretsProvider interface as DatabaseSecretsProvider,
// so switching is a one-line change in secret-manager.ts.
//
// Implementation checklist (when ready):
//   1. Set VAULT_ADDR and VAULT_TOKEN in env (or use VAULT_ROLE_ID + VAULT_SECRET_ID for AppRole)
//   2. Implement each method below against the KV v2 API
//   3. Set SECRET_PROVIDER=vault in env
//   4. Done — no business logic changes needed
//
// Vault KV v2 API reference:
//   GET    /v1/secret/data/<path>          — read secret
//   POST   /v1/secret/data/<path>          — write secret (versioned by default)
//   POST   /v1/secret/data/<path>?method=  — update
//   DELETE /v1/secret/data/<path>          — soft delete (keeps versions)
//   LIST   /v1/secret/metadata/<path>      — list secret keys
//   GET    /v1/secret/metadata/<path>      — read version metadata
//
// Authentication:
//   For local dev:  VAULT_TOKEN (root / dev token)
//   For production: AppRole (VAULT_ROLE_ID + VAULT_SECRET_ID → exchange for token)
//                   or Kubernetes Service Account with Vault's K8s auth method

import {
  SecretNotFoundError,
  SecretAlreadyExistsError,
  type SecretsProvider,
  type SecretKind,
  type SecretMetadata,
  type SaveSecretInput,
  type UpdateSecretInput,
  type ResolvedSecret,
} from "../types";

// ─── Vault API response shapes (KV v2) ────────────────────────────────────────

interface VaultKvData<T> {
  data: {
    data: T;
    metadata: {
      created_time: string;
      custom_metadata: Record<string, string> | null;
      deletion_time: string;
      destroyed: boolean;
      version: number;
    };
  };
  errors?: string[];
}

// ─── VaultSecretsProvider ─────────────────────────────────────────────────────

export class VaultSecretsProvider implements SecretsProvider {
  private readonly addr: string;
  private readonly token: string;
  /** KV v2 mount path, e.g. "secret" → /v1/secret/data/<ref> */
  private readonly mountPath: string;

  constructor() {
    // TODO: Support AppRole auth (VAULT_ROLE_ID + VAULT_SECRET_ID) as an alternative
    this.addr = process.env.VAULT_ADDR ?? "";
    this.token = process.env.VAULT_TOKEN ?? "";
    this.mountPath = process.env.VAULT_KV_MOUNT ?? "secret";

    if (!this.addr || !this.token) {
      throw new Error(
        "VaultSecretsProvider: VAULT_ADDR and VAULT_TOKEN must be set in environment."
      );
    }
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async getSecret<K extends SecretKind>(
    secretRef: string,
    kind: K
  ): Promise<ResolvedSecret<K>> {
    // TODO: Implement
    // const url = `${this.addr}/v1/${this.mountPath}/data/${secretRef}`;
    // const res = await fetch(url, { headers: this.headers() });
    // if (res.status === 404) throw new SecretNotFoundError(secretRef);
    // if (!res.ok) throw new Error(`Vault: HTTP ${res.status} reading '${secretRef}'`);
    // const body: VaultKvData<ResolvedSecret<K>["payload"]> = await res.json();
    // return this.toResolved(secretRef, kind, body);

    throw this.notImplemented("getSecret");
  }

  async hasSecret(secretRef: string): Promise<boolean> {
    // TODO: Implement — use LIST or HEAD on metadata endpoint
    // const url = `${this.addr}/v1/${this.mountPath}/metadata/${secretRef}`;
    // const res = await fetch(url, { method: "HEAD", headers: this.headers() });
    // return res.status === 200;

    void secretRef;
    throw this.notImplemented("hasSecret");
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async saveSecret<K extends SecretKind>(
    input: SaveSecretInput<K>
  ): Promise<ResolvedSecret<K>> {
    // TODO: Implement
    // const url = `${this.addr}/v1/${this.mountPath}/data/${input.secretRef}`;
    // Check existence first (KV v2 upserts by default — enforce "create only" semantics if desired):
    //   const exists = await this.hasSecret(input.secretRef);
    //   if (exists) throw new SecretAlreadyExistsError(input.secretRef);
    // const res = await fetch(url, {
    //   method: "POST",
    //   headers: this.headers(),
    //   body: JSON.stringify({ data: input.payload }),
    // });
    // if (!res.ok) throw new Error(`Vault: HTTP ${res.status} saving '${input.secretRef}'`);
    // const body = await res.json();
    // return this.toResolved(input.secretRef, input.kind, body);

    void input;
    throw this.notImplemented("saveSecret");
  }

  async updateSecret<K extends SecretKind>(
    secretRef: string,
    input: UpdateSecretInput<K>
  ): Promise<ResolvedSecret<K>> {
    // TODO: Implement — Vault KV v2 creates a new version automatically
    // const url = `${this.addr}/v1/${this.mountPath}/data/${secretRef}`;
    // const res = await fetch(url, {
    //   method: "POST",
    //   headers: this.headers(),
    //   body: JSON.stringify({ data: input.payload }),
    // });
    // if (res.status === 404) throw new SecretNotFoundError(secretRef);
    // if (!res.ok) throw new Error(`Vault: HTTP ${res.status} updating '${secretRef}'`);
    // const body = await res.json();
    // return this.toResolved(secretRef, kind, body);  // need kind from existing metadata

    void secretRef;
    void input;
    throw this.notImplemented("updateSecret");
  }

  async deleteSecret(secretRef: string): Promise<void> {
    // TODO: Implement — Vault KV v2's DELETE on /data/<path> soft-deletes
    // const url = `${this.addr}/v1/${this.mountPath}/data/${secretRef}`;
    // const res = await fetch(url, { method: "DELETE", headers: this.headers() });
    // if (res.status === 404) throw new SecretNotFoundError(secretRef);
    // if (!res.ok) throw new Error(`Vault: HTTP ${res.status} deleting '${secretRef}'`);

    void secretRef;
    throw this.notImplemented("deleteSecret");
  }

  async listSecrets(filter?: {
    resourceKey?: string;
    kind?: SecretKind;
  }): Promise<Omit<ResolvedSecret, "payload">[]> {
    // TODO: Implement
    // const url = `${this.addr}/v1/${this.mountPath}/metadata/`;
    // const res = await fetch(url, { method: "LIST", headers: this.headers() });
    // if (!res.ok) throw new Error(`Vault: HTTP ${res.status} listing secrets`);
    // const body = await res.json();
    // const keys: string[] = body?.data?.keys ?? [];
    // return keys.map(...); // filter by resourceKey / kind if needed

    void filter;
    throw this.notImplemented("listSecrets");
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      "X-Vault-Token": this.token,
      "Content-Type": "application/json",
    };
  }

  private notImplemented(method: string): Error {
    return new Error(
      `VaultSecretsProvider.${method}() is not yet implemented. ` +
      "See TODO comments in vault.provider.ts for the implementation guide."
    );
  }

  // TODO: Implement toResolved() helper once the API response shapes are confirmed
  // private toResolved<K extends SecretKind>(
  //   secretRef: string,
  //   kind: K,
  //   body: VaultKvData<ResolvedSecret<K>["payload"]>
  // ): ResolvedSecret<K> {
  //   const { data, metadata } = body.data;
  //   return {
  //     id: secretRef,   // Vault uses path as ID
  //     secretRef,
  //     kind,
  //     payload: data,
  //     metadata: {
  //       rotatedAt: metadata.created_time,
  //     },
  //     resolvedFrom: "vault",
  //     createdAt: metadata.created_time,
  //     updatedAt: metadata.created_time,
  //     version: metadata.version,
  //   };
  // }
}
