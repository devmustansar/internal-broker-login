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
    // Only accumulate bits within the 32-bit range; consume but discard higher bits.
    // Use >>> 0 after each OR to keep result as an unsigned 32-bit integer so
    // writeUInt32LE never receives a negative value.
    if (shift < 32) {
      result = (result | ((byte & 0x7f) << shift)) >>> 0;
    }
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

  type RawInfo = {
    width: number;
    height: number;
    channels: number;
  };

  function forceRgba(data: Buffer, info: RawInfo): Buffer {
    const { width, height, channels } = info;

    if (channels === 4) {
      return data;
    }

    const pixelCount = width * height;
    const rgba = Buffer.alloc(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      if (channels === 1) {
        const gray = data[i];

        rgba[i * 4] = gray;
        rgba[i * 4 + 1] = gray;
        rgba[i * 4 + 2] = gray;
        rgba[i * 4 + 3] = 255;
      } else if (channels === 2) {
        const gray = data[i * 2];
        const alpha = data[i * 2 + 1];

        rgba[i * 4] = gray;
        rgba[i * 4 + 1] = gray;
        rgba[i * 4 + 2] = gray;
        rgba[i * 4 + 3] = alpha;
      } else if (channels === 3) {
        rgba[i * 4] = data[i * 3];
        rgba[i * 4 + 1] = data[i * 3 + 1];
        rgba[i * 4 + 2] = data[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
    }

    return rgba;
  }

  function tryDecodeWithJsQr(data: Buffer, info: RawInfo): string | null {
    const rgba = forceRgba(data, info);

    if (rgba.length !== info.width * info.height * 4) {
      return null;
    }

    const clamped = new Uint8ClampedArray(
      rgba.buffer,
      rgba.byteOffset,
      rgba.byteLength
    );

    const result = jsQR(clamped, info.width, info.height, {
      inversionAttempts: "attemptBoth",
    });

    return result?.data ?? null;
  }

  async function trySharpPipeline(
    pipelineFactory: () => any
  ): Promise<string | null> {
    const { data, info } = await pipelineFactory()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const result = tryDecodeWithJsQr(data, info);

    if (result) {
      return result;
    }

    return null;
  }

  async function tryFallbackQrReader(
    pipelineFactory: () => any
  ): Promise<string | null> {
    try {
      const jimpModule: any = await import("jimp");
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — no type declarations for qrcode-reader
      const qrReaderModule: any = await import("qrcode-reader");

      const Jimp = jimpModule.Jimp ?? jimpModule.default ?? jimpModule;
      const QRCodeReader = qrReaderModule.default ?? qrReaderModule;

      const pngBuffer = await pipelineFactory().png().toBuffer();
      const image = await Jimp.read(pngBuffer);

      const result = await new Promise<string | null>((resolve) => {
        const qr = new QRCodeReader();

        qr.callback = (err: Error | null, value: any) => {
          if (err || !value?.result) {
            resolve(null);
            return;
          }

          resolve(value.result);
        };

        qr.decode(image.bitmap);
      });

      return result ?? null;
    } catch {
      return null;
    }
  }

  const base = () => sharp(imageBuffer, { failOn: "none" }).rotate();

  /**
   * Attempt group 1:
   * Normal QR images.
   */
  const simpleAttempts: Array<{
    label: string;
    pipelineFactory: () => any;
  }> = [
      {
        label: "simple-normal",
        pipelineFactory: () =>
          base()
            .flatten({ background: "#ffffff" })
            .normalize()
            .sharpen()
            .ensureAlpha(),
      },
      {
        label: "simple-resized-1600",
        pipelineFactory: () =>
          base()
            .resize({
              width: 1600,
              withoutEnlargement: false,
            })
            .flatten({ background: "#ffffff" })
            .normalize()
            .sharpen()
            .ensureAlpha(),
      },
      {
        label: "simple-threshold-140",
        pipelineFactory: () =>
          base()
            .resize({
              width: 1600,
              withoutEnlargement: false,
              kernel: sharp.kernel.nearest,
            })
            .flatten({ background: "#ffffff" })
            .threshold(140)
            .ensureAlpha(),
      },
      {
        label: "simple-threshold-180",
        pipelineFactory: () =>
          base()
            .resize({
              width: 1600,
              withoutEnlargement: false,
              kernel: sharp.kernel.nearest,
            })
            .flatten({ background: "#ffffff" })
            .threshold(180)
            .ensureAlpha(),
      },
      {
        label: "simple-inverted",
        pipelineFactory: () =>
          base()
            .resize({
              width: 1600,
              withoutEnlargement: false,
            })
            .flatten({ background: "#ffffff" })
            .negate()
            .normalize()
            .ensureAlpha(),
      },
    ];

  for (const attempt of simpleAttempts) {
    const result = await trySharpPipeline(attempt.pipelineFactory);
    if (result) return result;
  }

  /**
   * Attempt group 2:
   * Detect QR canvas/crop area.
   * This is needed for QR images with dark outer background.
   */
  const { data: rawData, info: rawInfo } = await base()
    .flatten({ background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = rawInfo;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  /**
   * Find the visible white QR canvas.
   * Your sample QR has a black outer background and a white QR square.
   */
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;

      const r = rawData[idx];
      const g = rawData[idx + 1];
      const b = rawData[idx + 2];

      if (r > 180 && g > 180 && b > 180) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX >= maxX || minY >= maxY) {
    throw new Error("No QR code found in image");
  }

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;

  console.log("[parseQrImageBuffer] crop box", {
    minX,
    minY,
    maxX,
    maxY,
    cropWidth,
    cropHeight,
  });

  const border = 80;

  const cropBase = () =>
    sharp(imageBuffer, { failOn: "none" })
      .rotate()
      .extract({
        left: minX,
        top: minY,
        width: cropWidth,
        height: cropHeight,
      });

  /**
   * Important:
   * Do not force 846 -> 1600 for dense QR codes first.
   * Non-integer scaling can break dense Google Authenticator migration QR images.
   */
  const cropAttempts: Array<{
    label: string;
    pipelineFactory: () => any;
  }> = [
      {
        label: "crop-border-original",
        pipelineFactory: () =>
          cropBase()
            .extend({
              top: border,
              bottom: border,
              left: border,
              right: border,
              background: "#ffffff",
            })
            .flatten({ background: "#ffffff" })
            .ensureAlpha(),
      },
      {
        label: "crop-border-threshold-120-original",
        pipelineFactory: () =>
          cropBase()
            .extend({
              top: border,
              bottom: border,
              left: border,
              right: border,
              background: "#ffffff",
            })
            .flatten({ background: "#ffffff" })
            .threshold(120)
            .ensureAlpha(),
      },
      {
        label: "crop-border-threshold-140-original",
        pipelineFactory: () =>
          cropBase()
            .extend({
              top: border,
              bottom: border,
              left: border,
              right: border,
              background: "#ffffff",
            })
            .flatten({ background: "#ffffff" })
            .threshold(140)
            .ensureAlpha(),
      },
      {
        label: "crop-border-threshold-180-original",
        pipelineFactory: () =>
          cropBase()
            .extend({
              top: border,
              bottom: border,
              left: border,
              right: border,
              background: "#ffffff",
            })
            .flatten({ background: "#ffffff" })
            .threshold(180)
            .ensureAlpha(),
      },
      {
        label: "crop-border-2x-nearest",
        pipelineFactory: () =>
          cropBase()
            .extend({
              top: border,
              bottom: border,
              left: border,
              right: border,
              background: "#ffffff",
            })
            .resize({
              width: (cropWidth + border * 2) * 2,
              height: (cropHeight + border * 2) * 2,
              fit: "fill",
              kernel: sharp.kernel.nearest,
            })
            .flatten({ background: "#ffffff" })
            .ensureAlpha(),
      },
      {
        label: "crop-border-3x-nearest",
        pipelineFactory: () =>
          cropBase()
            .extend({
              top: border,
              bottom: border,
              left: border,
              right: border,
              background: "#ffffff",
            })
            .resize({
              width: (cropWidth + border * 2) * 3,
              height: (cropHeight + border * 2) * 3,
              fit: "fill",
              kernel: sharp.kernel.nearest,
            })
            .flatten({ background: "#ffffff" })
            .ensureAlpha(),
      },
      {
        label: "crop-border-2x-threshold-140",
        pipelineFactory: () =>
          cropBase()
            .extend({
              top: border,
              bottom: border,
              left: border,
              right: border,
              background: "#ffffff",
            })
            .resize({
              width: (cropWidth + border * 2) * 2,
              height: (cropHeight + border * 2) * 2,
              fit: "fill",
              kernel: sharp.kernel.nearest,
            })
            .flatten({ background: "#ffffff" })
            .threshold(140)
            .ensureAlpha(),
      },
    ];

  for (const attempt of cropAttempts) {
    const result = await trySharpPipeline(attempt.pipelineFactory);
    if (result) return result;
  }

  /**
   * Attempt group 3:
   * Fallback decoder.
   *
   * Install:
   * npm install jimp qrcode-reader
   */
  for (const attempt of cropAttempts) {
    const result = await tryFallbackQrReader(attempt.pipelineFactory);
    if (result) return result;
  }

  for (const attempt of simpleAttempts) {
    const result = await tryFallbackQrReader(attempt.pipelineFactory);
    if (result) return result;
  }

  throw new Error("No QR code found in image");
}
