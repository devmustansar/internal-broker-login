import { prisma } from "@/lib/prisma";
import { encryptPayload, decryptPayload } from "../encryption";
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

// ─── DatabaseSecretsProvider ──────────────────────────────────────────────────
//
// Stores encrypted credentials in the `StoredSecret` Postgres table.
// The payload column is encrypted with AES-256-GCM before write and decrypted
// transparently on read.  Prisma only ever sees ciphertext — never plaintext.
//
// This class is the ONLY place in the codebase that:
//   - Accesses the StoredSecret Prisma model
//   - Calls encrypt/decryptPayload
//
// Swap this class for VaultSecretsProvider without touching any service code.

export class DatabaseSecretsProvider implements SecretsProvider {
  // ── Read ───────────────────────────────────────────────────────────────────

  async getSecret<K extends SecretKind>(
    secretRef: string,
    kind: K
  ): Promise<ResolvedSecret<K>> {
    const row = await prisma.storedSecret.findUnique({
      where: { secretRef, deletedAt: null },
    });

    if (!row) {
      throw new SecretNotFoundError(secretRef);
    }

    const payload = decryptPayload<ResolvedSecret<K>["payload"]>(
      row.encryptedPayload,
      secretRef
    );

    return this.toResolved<K>(row, kind, payload);
  }

  async hasSecret(secretRef: string): Promise<boolean> {
    const count = await prisma.storedSecret.count({
      where: { secretRef, deletedAt: null },
    });
    return count > 0;
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async saveSecret<K extends SecretKind>(
    input: SaveSecretInput<K>
  ): Promise<ResolvedSecret<K>> {
    const { secretRef, kind, payload, metadata = {} } = input;

    const alreadyExists = await this.hasSecret(secretRef);
    if (alreadyExists) {
      throw new SecretAlreadyExistsError(secretRef);
    }

    const encryptedPayload = encryptPayload(payload);

    const row = await prisma.storedSecret.create({
      data: {
        secretRef,
        kind,
        encryptedPayload,
        metadata: metadata as object,
        provider: "database",
        version: 1,
      },
    });

    return this.toResolved<K>(row, kind, payload);
  }

  async updateSecret<K extends SecretKind>(
    secretRef: string,
    input: UpdateSecretInput<K>
  ): Promise<ResolvedSecret<K>> {
    const existing = await prisma.storedSecret.findUnique({
      where: { secretRef, deletedAt: null },
    });

    if (!existing) {
      throw new SecretNotFoundError(secretRef);
    }

    const encryptedPayload = encryptPayload(input.payload);

    // Merge metadata: existing (as object) + incoming partial update
    const existingMeta = (existing.metadata as SecretMetadata) ?? {};
    const mergedMeta: SecretMetadata = { ...existingMeta, ...input.metadata };

    const updated = await prisma.storedSecret.update({
      where: { id: existing.id },
      data: {
        encryptedPayload,
        metadata: mergedMeta as object,
        version: { increment: 1 },
      },
    });

    return this.toResolved<K>(updated, existing.kind as K, input.payload);
  }

  async deleteSecret(secretRef: string): Promise<void> {
    const existing = await prisma.storedSecret.findUnique({
      where: { secretRef, deletedAt: null },
    });

    if (!existing) {
      throw new SecretNotFoundError(secretRef);
    }

    // Soft delete — row is kept for audit trail
    await prisma.storedSecret.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  // ── List (admin / audit) ───────────────────────────────────────────────────

  async listSecrets(filter?: {
    resourceKey?: string;
    kind?: SecretKind;
  }): Promise<Omit<ResolvedSecret, "payload">[]> {
    const rows = await prisma.storedSecret.findMany({
      where: {
        deletedAt: null,
        ...(filter?.kind ? { kind: filter.kind } : {}),
        ...(filter?.resourceKey
          ? {
              metadata: {
                path: ["resourceKey"],
                equals: filter.resourceKey,
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      secretRef: row.secretRef,
      kind: row.kind as SecretKind,
      metadata: (row.metadata as SecretMetadata) ?? {},
      resolvedFrom: "database" as const,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toResolved<K extends SecretKind>(
    row: {
      id: string;
      secretRef: string;
      kind: string;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
      version: number;
    },
    kind: K,
    payload: ResolvedSecret<K>["payload"]
  ): ResolvedSecret<K> {
    return {
      id: row.id,
      secretRef: row.secretRef,
      kind,
      payload,
      metadata: (row.metadata as SecretMetadata) ?? {},
      resolvedFrom: "database",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    };
  }
}
