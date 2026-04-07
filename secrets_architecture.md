# Secrets Management Architecture

## 1. Architecture Overview

```
Business logic (aws-broker.service, broker-session.service)
        │
        │  import { secretManager }
        ▼
┌─────────────────────────────────┐
│   secret-manager.ts (singleton) │  ← Only entrypoint for all services
│   reads SECRET_PROVIDER env var │
└────────────┬────────────────────┘
             │
  ┌──────────┼────────────────────┐
  │          │                    │
  ▼          ▼                    ▼
DatabaseSecretsProvider  VaultSecretsProvider  HybridSecretsProvider
  │ (current)              (stub/TODO)           (routes per secretRef)
  │                                              ├── DB provider
  ▼                                              └── Vault provider
Postgres/Prisma
StoredSecret table
(AES-256-GCM ciphertext)
```

**Contract**: All services depend only on `SecretsProvider` interface. Zero coupling to Prisma models, Vault SDK, or encryption internals.

---

## 2. Folder Structure

```
src/server/secrets/
├── types.ts                        ← SecretsProvider interface + all domain types
├── encryption.ts                   ← AES-256-GCM encrypt/decrypt (isolated utility)
├── secret-manager.ts               ← Singleton factory (reads SECRET_PROVIDER)
└── providers/
    ├── database.provider.ts        ← Real implementation (DB + encryption)
    ├── vault.provider.ts           ← Stub (all methods throw "not implemented")
    └── hybrid.provider.ts          ← Routes per secretRef to DB or Vault

src/server/services/
└── secrets-admin.service.ts        ← Admin/seed layer (typed save/update/upsert)

prisma/schema.prisma
├── StoredSecret                    ← Encrypted credential rows
└── StoredSecretRef                 ← Hybrid routing table (secretRef → provider)
```

---

## 3. Prisma Schema (additions)

```prisma
model StoredSecret {
  id               String    @id @default(uuid())
  secretRef        String    @unique          // e.g. "aws/broker/default"
  kind             String                     // SecretKind discriminant
  encryptedPayload String                     // AES-256-GCM ciphertext
  metadata         Json      @default("{}")   // audit-safe — no plaintext
  provider         String    @default("database")
  version          Int       @default(1)
  deletedAt        DateTime?                  // soft delete
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model StoredSecretRef {
  id        String    @id @default(uuid())
  secretRef String    @unique
  provider  String    // "database" | "vault"
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

---

## 4. Secret Kinds (strong typing)

| `SecretKind` | Payload interface | Use case |
|---|---|---|
| `aws_iam_credentials` | `{ accessKeyId, secretAccessKey, sessionToken? }` | AWS IAM broker user |
| `web_basic_credentials` | `{ username, password, extra? }` | Web app login (Jira, internal tools) |
| `jira_api_token` | `{ email, apiToken }` | Atlassian Cloud API token |
| `generic_key_value` | `{ [key: string]: string }` | Escape hatch for anything else |

---

## 5. Encryption Details

- **Algorithm**: AES-256-GCM (authenticated encryption — detects tampering)
- **Key size**: 256-bit derived from `SECRET_ENCRYPTION_KEY` via scrypt
- **IV**: 96-bit random per encryption (prepended to ciphertext)
- **Auth tag**: 128-bit (appended)
- **Storage format**: `<iv_hex>:<authTag_hex>:<ciphertext_hex>` (single column)
- **Key derivation**: `scryptSync(rawKey, staticSalt, 32, {N:16384, r:8, p:1})`

The DB column `encryptedPayload` is the **only** place sensitive data lives. All other columns are audit-safe.

---

## 6. SecretsProvider Interface

```typescript
interface SecretsProvider {
  getSecret<K extends SecretKind>(secretRef: string, kind: K): Promise<ResolvedSecret<K>>;
  saveSecret<K extends SecretKind>(input: SaveSecretInput<K>):  Promise<ResolvedSecret<K>>;
  updateSecret<K extends SecretKind>(secretRef: string, input: UpdateSecretInput<K>): Promise<ResolvedSecret<K>>;
  deleteSecret(secretRef: string): Promise<void>;
  hasSecret(secretRef: string):   Promise<boolean>;
  listSecrets(filter?: { resourceKey?: string; kind?: SecretKind }): Promise<Omit<ResolvedSecret, "payload">[]>;
}
```

---

## 7. Example Usage in Services

### Reading a secret (AWS broker)
```typescript
import { secretManager } from "@/server/secrets/secret-manager";

// In aws-broker.service.ts — no coupling to DB or crypto
const secret = await secretManager.getSecret("aws/broker/default", "aws_iam_credentials");
const { accessKeyId, secretAccessKey } = secret.payload;
// Pass to STS — never log these values
```

### Saving a secret (admin / seed)
```typescript
import { secretsAdminService } from "@/server/services/secrets-admin.service";

await secretsAdminService.saveOrUpdateAwsCredentials(
  "aws/broker/default",
  { accessKeyId: "AKIA...", secretAccessKey: "..." },
  { label: "Prod broker IAM key", resourceKey: "aws-prod-readonly" }
);

await secretsAdminService.saveOrUpdateWebCredentials(
  "web/jira/prod",
  { username: "svc-broker@company.com", password: "..." },
  { label: "Jira broker account", resourceKey: "jira-prod" }
);
```

---

## 8. Provider Selection (SECRET_PROVIDER env)

| Value | Behaviour |
|---|---|
| `database` (default) | All secrets to DatabaseSecretsProvider |
| `vault` | All secrets to VaultSecretsProvider (needs VAULT_ADDR + VAULT_TOKEN) |
| `hybrid` | Per-secret routing via StoredSecretRef table |

Changing `SECRET_PROVIDER` from `database` to `vault` requires **zero changes** to any service code.

---

## 9. Environment Variables

```bash
SECRET_PROVIDER=database           # database | vault | hybrid
SECRET_ENCRYPTION_KEY=<64-hex>     # REQUIRED for database + hybrid
VAULT_ADDR=https://vault:8200      # REQUIRED for vault + hybrid
VAULT_TOKEN=<token>                # REQUIRED for vault + hybrid
VAULT_KV_MOUNT=secret              # default: "secret"
```

Generate a key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Store in production via: AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, or CI/CD encrypted secrets. **Never commit to source control.**

---

## 10. Security Notes

1. `ResolvedSecret.payload` is plaintext — never log or serialize to HTTP responses
2. `listSecrets()` omits `payload` — safe for admin endpoints
3. GCM auth tag detects any tampering of the ciphertext automatically
4. Random 96-bit IV per write — same plaintext → different ciphertext every time
5. Soft delete keeps rows for audit trail but excludes from active reads
6. `version` counter prevents silent overwrites (future optimistic concurrency)
7. `metadata` column is audit-safe (label, resourceKey, tags only — no secrets)
8. Key validation at startup — fails loudly if missing or too short

---

## 11. Migration Path

### Phase 1 — Today (DB only)
```
SECRET_PROVIDER=database
SECRET_ENCRYPTION_KEY=<key>
```

### Phase 2 — Hybrid (incremental Vault adoption)
```
SECRET_PROVIDER=hybrid
SECRET_ENCRYPTION_KEY=<key>   # still needed for old DB secrets
VAULT_ADDR=…
VAULT_TOKEN=…
```
New resources write to Vault. Old resources still read from DB unchanged.

### Phase 3 — Vault only
```
1. Implement VaultSecretsProvider methods (see vault.provider.ts TODO comments)
2. Run migration script: push all DB secrets to Vault
3. Switch SECRET_PROVIDER=vault
4. Remove SECRET_ENCRYPTION_KEY
5. Optionally archive StoredSecret table
```

**Zero service code changes at any phase transition.**
