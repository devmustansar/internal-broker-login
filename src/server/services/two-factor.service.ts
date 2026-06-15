import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/server/secrets/encryption";
import type { ParsedOtpAuth, MigrationEntry, QrParseResult } from "@/types";

// ─── TOTP (RFC 6238) — native Node.js crypto, no external deps ───────────────

function base32Decode(s: string): Buffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const input = s.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.floor((input.length * 5) / 8));
  for (let i = 0; i < input.length; i++) {
    const charIndex = chars.indexOf(input[i]);
    if (charIndex === -1) continue;
    value = (value << 5) | charIndex;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return output.slice(0, index);
}

const ALGO_MAP: Record<string, string> = {
  SHA1: "sha1",
  SHA256: "sha256",
  SHA512: "sha512",
};

export function generateTotp(
  secret: string,
  algorithm = "SHA1",
  digits = 6,
  period = 30
): { otp: string; remainingSeconds: number; expiresAt: string } {
  const key = base32Decode(secret);
  const epochSeconds = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epochSeconds / period);

  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmacAlgo = ALGO_MAP[algorithm.toUpperCase()] ?? "sha1";
  const hmac = createHmac(hmacAlgo, key);
  hmac.update(buf);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0xf;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = String(code % Math.pow(10, digits)).padStart(digits, "0");
  const remainingSeconds = period - (epochSeconds % period);
  const expiresAt = new Date(Date.now() + remainingSeconds * 1000).toISOString();

  return { otp, remainingSeconds, expiresAt };
}

// ─── otpauth:// URI parsing ───────────────────────────────────────────────────

export function parseOtpAuthUri(uri: string): ParsedOtpAuth {
  if (!uri.startsWith("otpauth://totp/")) {
    throw new Error("Not a valid otpauth://totp/ URI");
  }

  const withoutScheme = uri.slice("otpauth://totp/".length);
  const qmarkIdx = withoutScheme.indexOf("?");
  const labelRaw = qmarkIdx === -1 ? withoutScheme : withoutScheme.slice(0, qmarkIdx);
  const queryString = qmarkIdx === -1 ? "" : withoutScheme.slice(qmarkIdx + 1);

  const label = decodeURIComponent(labelRaw);
  const params = new URLSearchParams(queryString);

  const secret = params.get("secret");
  if (!secret) throw new Error("Missing secret in otpauth URI");

  const colonIdx = label.indexOf(":");
  const issuerFromLabel = colonIdx !== -1 ? label.slice(0, colonIdx).trim() : null;
  const accountFromLabel = colonIdx !== -1 ? label.slice(colonIdx + 1).trim() : label.trim();

  return {
    secret: secret.toUpperCase().replace(/\s/g, ""),
    issuer: params.get("issuer") ?? issuerFromLabel,
    accountLabel: accountFromLabel || null,
    algorithm: params.get("algorithm")?.toUpperCase() ?? "SHA1",
    digits: parseInt(params.get("digits") ?? "6", 10),
    period: parseInt(params.get("period") ?? "30", 10),
    rawUri: uri,
  };
}

// ─── Google Authenticator migration QR (otpauth-migration://) ────────────────
//
// The migration URI carries a base64-encoded protobuf payload (MigrationPayload).
// We decode it with a minimal hand-rolled parser — no protobuf library needed.
//
// MigrationPayload schema (field numbers):
//   1: otp_parameters (repeated message)
//     1: secret (bytes)        — raw TOTP secret bytes
//     2: name (string)         — "Issuer:account" or just "account"
//     3: issuer (string)
//     4: algorithm (varint)    0/1=SHA1, 2=SHA256, 3=SHA512, 4=MD5
//     5: digits (varint)       0/1=6, 2=8
//     6: type (varint)         1=HOTP, 2=TOTP
//     7: counter (int64)       HOTP only
//   2: version, 3: batch_size, 4: batch_index, 5: batch_id

function base32Encode(bytes: Buffer): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      result += chars[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) result += chars[(value << (5 - bits)) & 0x1f];
  return result;
}

function readVarint(buf: Buffer, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  while (offset < buf.length) {
    const byte = buf[offset++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, next: offset };
}

function parseProtobuf(buf: Buffer): Record<number, Buffer[]> {
  const fields: Record<number, Buffer[]> = {};
  let offset = 0;
  while (offset < buf.length) {
    const { value: tag, next: afterTag } = readVarint(buf, offset);
    offset = afterTag;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;
    if (wireType === 0) {
      const { value, next } = readVarint(buf, offset);
      offset = next;
      const varintBuf = Buffer.alloc(4);
      varintBuf.writeUInt32LE(value, 0);
      (fields[fieldNumber] ??= []).push(varintBuf);
    } else if (wireType === 2) {
      const { value: len, next: afterLen } = readVarint(buf, offset);
      offset = afterLen;
      (fields[fieldNumber] ??= []).push(buf.slice(offset, offset + len));
      offset += len;
    } else if (wireType === 1) {
      offset += 8;
    } else if (wireType === 5) {
      offset += 4;
    } else {
      break;
    }
  }
  return fields;
}

const GA_ALGO: Record<number, string> = { 0: "SHA1", 1: "SHA1", 2: "SHA256", 3: "SHA512" };
const GA_DIGITS: Record<number, number> = { 0: 6, 1: 6, 2: 8 };

function parseOtpParameter(buf: Buffer): MigrationEntry & { isMd5: boolean } {
  const f = parseProtobuf(buf);
  const secretBytes: Buffer = f[1]?.[0] ?? Buffer.alloc(0);
  const nameRaw: string = f[2]?.[0]?.toString("utf8") ?? "";
  const issuerRaw: string = f[3]?.[0]?.toString("utf8") ?? "";
  const algorithm: number = f[4]?.[0]?.readUInt32LE(0) ?? 1;
  const digits: number = f[5]?.[0]?.readUInt32LE(0) ?? 1;
  const type: number = f[6]?.[0]?.readUInt32LE(0) ?? 2;

  const colonIdx = nameRaw.indexOf(":");
  const issuerFromName = colonIdx !== -1 ? nameRaw.slice(0, colonIdx).trim() : null;
  const accountLabel = colonIdx !== -1 ? nameRaw.slice(colonIdx + 1).trim() : nameRaw.trim() || null;

  return {
    secret: base32Encode(secretBytes),
    issuer: issuerRaw || issuerFromName,
    accountLabel,
    algorithm: GA_ALGO[algorithm] ?? "SHA1",
    digits: GA_DIGITS[digits] ?? 6,
    period: 30,
    isTotp: type === 2,
    isMd5: algorithm === 4,
  };
}

export function parseMigrationUri(uri: string): { type: "migration"; entries: MigrationEntry[]; skippedHotp: number } {
  if (!uri.startsWith("otpauth-migration://")) {
    throw new Error("Not a valid otpauth-migration:// URI");
  }

  const url = new URL(uri);
  const dataParam = url.searchParams.get("data");
  if (!dataParam) throw new Error("Missing data parameter in migration URI");

  const protobufBytes = Buffer.from(dataParam, "base64");
  const payload = parseProtobuf(protobufBytes);
  const otpParams: Buffer[] = payload[1] ?? [];

  let skippedHotp = 0;
  const entries: MigrationEntry[] = [];

  for (const paramBuf of otpParams) {
    const parsed = parseOtpParameter(paramBuf);
    if (!parsed.isTotp) { skippedHotp++; continue; }
    if (parsed.isMd5) continue;
    const { isMd5: _, ...entry } = parsed;
    entries.push(entry);
  }

  return { type: "migration", entries, skippedHotp };
}

// ─── Smart QR URI dispatcher ──────────────────────────────────────────────────

export function parseQrUri(uri: string): QrParseResult {
  if (uri.startsWith("otpauth-migration://")) {
    return parseMigrationUri(uri);
  }
  if (uri.startsWith("otpauth://totp/")) {
    const parsed = parseOtpAuthUri(uri);
    return { type: "totp", ...parsed };
  }
  throw new Error("Unrecognised QR code format. Expected otpauth://totp/ or otpauth-migration://offline");
}

// ─── Secret encryption helpers ───────────────────────────────────────────────

export function encryptSecret(plaintext: string): string {
  return encrypt(plaintext);
}

export function decryptSecret(ciphertext: string, entryId: string): string {
  return decrypt(ciphertext, `2fa-entry:${entryId}`);
}

// ─── Audit helpers ───────────────────────────────────────────────────────────

export async function logOtpAccess(opts: {
  twoFactorEntryId: string;
  organizationId: string;
  userId: string | null;
  action: "otp_viewed" | "otp_copied" | "unauthorized_access_attempt";
  outcome: "success" | "failure";
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.twoFactorAccessLog.create({
    data: {
      twoFactorEntryId: opts.twoFactorEntryId,
      organizationId: opts.organizationId,
      userId: opts.userId,
      action: opts.action,
      outcome: opts.outcome,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
      details: (opts.details ?? undefined) as any,
    },
  });
}

export async function logManagementAction(opts: {
  action: string;
  userId: string;
  organizationId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: opts.action,
      userId: opts.userId,
      organizationId: opts.organizationId,
      outcome: "success",
      details: (opts.details ?? undefined) as any,
    },
  });
}

// ─── QR image parsing ────────────────────────────────────────────────────────

export async function parseQrImageBuffer(imageBuffer: Buffer): Promise<string> {
  const sharp = (await import("sharp")).default;
  const jsQR = (await import("jsqr")).default;

  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!code) throw new Error("No QR code found in image");

  return code.data;
}
