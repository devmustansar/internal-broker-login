import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { SecretEncryptionKeyError, SecretDecryptionError } from "./types";

// ─── AES-256-GCM Encryption Utility ──────────────────────────────────────────
//
// Provides application-level encryption for secret payloads before they reach
// the database.  The database only ever sees ciphertext.
//
// Algorithm: AES-256-GCM
//   - 256-bit key (derived from env via scrypt)
//   - 96-bit random IV per encryption (prepended to ciphertext)
//   - 128-bit authentication tag (appended to ciphertext)
//   - Storage format (hex-encoded, colon-separated):
//       <iv_hex>:<authTag_hex>:<ciphertext_hex>
//
// Key management:
//   - Set SECRET_ENCRYPTION_KEY in your environment (min 32 chars of entropy).
//   - Rotate by re-encrypting all rows with the new key (migration script needed).
//   - In production, SECRET_ENCRYPTION_KEY should come from a secrets manager
//     (e.g. Vault dynamic secrets, AWS Secrets Manager, GCP Secret Manager).
//   - Never commit the key to source control.
//   - Add SECRET_ENCRYPTION_KEY to your CI/CD secret store.
//
// IMPORTANT: Losing the key means losing all secrets — treat it like a root cert.

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH_BYTES = 12;  // 96-bit IV — recommended for GCM
const KEY_LENGTH_BYTES = 32; // 256-bit key
const SALT = "broker-secrets-kdf-salt-v1";  // static salt for key derivation

// ─── Key bootstrap ────────────────────────────────────────────────────────────

/**
 * Derive a 32-byte AES key from the raw env string using scrypt.
 * This is called once at startup and cached in the module scope.
 *
 * scrypt parameters (N=2^14, r=8, p=1) are intentionally lightweight because:
 *   - We call this once at process start, not per-request
 *   - The env key itself should already have high entropy
 */
function deriveKey(rawKey: string): Buffer {
  return scryptSync(rawKey, SALT, KEY_LENGTH_BYTES, { N: 16384, r: 8, p: 1 });
}

function loadEncryptionKey(): Buffer {
  const raw = process.env.SECRET_ENCRYPTION_KEY;

  if (!raw || raw.trim().length === 0) {
    throw new SecretEncryptionKeyError(
      "SECRET_ENCRYPTION_KEY environment variable is not set. " +
      "Generate a secure key: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  if (raw.trim().length < 32) {
    throw new SecretEncryptionKeyError(
      "SECRET_ENCRYPTION_KEY is too short. Use at least 32 characters (256 bits of entropy)."
    );
  }

  return deriveKey(raw.trim());
}

// Lazy singleton — key is loaded and derived once on first use.
let _cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (!_cachedKey) {
    _cachedKey = loadEncryptionKey();
  }
  return _cachedKey;
}

// ─── Encryption ───────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string.
 * Returns a storage-safe string: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *
 * @param plaintext - Any UTF-8 string (typically JSON.stringify of the payload)
 * @throws {SecretEncryptionKeyError} if the key is missing or too short
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

// ─── Decryption ───────────────────────────────────────────────────────────────

/**
 * Decrypt a ciphertext string produced by {@link encrypt}.
 *
 * @param stored    - The stored string "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * @param secretRef - Used only for error messages (never logged as part of ciphertext)
 * @throws {SecretDecryptionError} if the format is invalid, the tag fails, or
 *                                  the key doesn't match (tampered / wrong key)
 */
export function decrypt(stored: string, secretRef: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new SecretDecryptionError(
      secretRef,
      new Error("Stored value has unexpected format (expected iv:tag:ciphertext)")
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (err) {
    // GCM auth tag failure surfaces as an error from decipher.final()
    // This means the data was tampered with OR the wrong key is in use.
    throw new SecretDecryptionError(secretRef, err);
  }
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

/**
 * Serialize and encrypt an object payload.
 * Use this before writing to the DB.
 */
export function encryptPayload<T extends object>(payload: T): string {
  return encrypt(JSON.stringify(payload));
}

/**
 * Decrypt and deserialize a payload from the DB.
 * Use this after reading from the DB.
 *
 * @throws {SecretDecryptionError} on any failure
 */
export function decryptPayload<T extends object>(
  stored: string,
  secretRef: string
): T {
  const json = decrypt(stored, secretRef);
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new SecretDecryptionError(
      secretRef,
      new Error("Decrypted payload is not valid JSON")
    );
  }
}

// ─── Key rotation helper ───────────────────────────────────────────────────────
//
// When rotating SECRET_ENCRYPTION_KEY:
//   1. Set SECRET_ENCRYPTION_KEY_OLD=<old key> and SECRET_ENCRYPTION_KEY=<new key>
//   2. Run a migration script that calls re-encrypt() on every StoredSecret row
//   3. Remove SECRET_ENCRYPTION_KEY_OLD from env
//
// TODO: Implement a migration script at scripts/rotate-secret-key.ts

/**
 * Re-encrypt a ciphertext under the old key with the new key.
 * Used only during key rotation.
 *
 * @param stored    - Old ciphertext
 * @param oldRawKey - The old SECRET_ENCRYPTION_KEY value
 * @param secretRef - For error messages
 */
export function reEncryptWithOldKey(
  stored: string,
  oldRawKey: string,
  secretRef: string
): string {
  // Decrypt with old key
  const oldKey = deriveKey(oldRawKey);
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new SecretDecryptionError(secretRef, new Error("Bad format during re-encryption"));
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  let plaintext: string;
  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, oldKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    plaintext = decrypted.toString("utf8");
  } catch (err) {
    throw new SecretDecryptionError(secretRef, err);
  }

  // Re-encrypt with current (new) key
  return encrypt(plaintext);
}
