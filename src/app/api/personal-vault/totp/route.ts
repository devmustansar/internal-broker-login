import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/server/secrets/encryption";
import { parseOtpAuthUri } from "@/server/services/two-factor.service";
import { logPersonalVaultAction } from "@/server/services/personal-vault.service";

const VALID_ALGORITHMS = ["SHA1", "SHA256", "SHA512"];
const VALID_DIGITS = [6, 8];
const VALID_PERIODS = [30, 60];
const BASE32_RE = /^[A-Z2-7]+=*$/i;

function validateSecret(s: string): string | null {
  const clean = s.toUpperCase().replace(/\s/g, "");
  if (!BASE32_RE.test(clean)) return null;
  if (clean.replace(/=+$/, "").length < 16) return null;
  return clean;
}

/**
 * GET /api/personal-vault/totp
 * Lists the current user's own personal 2FA entries. Never returns the encrypted secret.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const entries = await prisma.personalTwoFactorEntry.findMany({
      where: { ownerUserId: auth.userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, appName: true, issuer: true, accountLabel: true,
        algorithm: true, digits: true, period: true, notes: true,
        createdAt: true, updatedAt: true,
      },
    });

    return NextResponse.json(entries);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/personal-vault/totp
 * inputMode: "manual" | "uri"
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const { inputMode = "manual" } = body;

    let secret: string;
    let issuer: string | null = body.issuer ?? null;
    let accountLabel: string | null = body.accountLabel ?? null;
    let algorithm: string = body.algorithm?.toUpperCase() ?? "SHA1";
    let digits: number = parseInt(body.digits ?? "6", 10);
    let period: number = parseInt(body.period ?? "30", 10);

    if (inputMode === "uri") {
      if (!body.uri) return badRequest("uri is required for inputMode=uri");
      const parsed = parseOtpAuthUri(body.uri);
      secret = parsed.secret;
      issuer = body.issuer ?? parsed.issuer;
      accountLabel = body.accountLabel ?? parsed.accountLabel;
      algorithm = body.algorithm?.toUpperCase() ?? parsed.algorithm;
      digits = parseInt(body.digits ?? String(parsed.digits), 10);
      period = parseInt(body.period ?? String(parsed.period), 10);
    } else {
      if (!body.secret) return badRequest("secret is required");
      const clean = validateSecret(body.secret);
      if (!clean) return badRequest("Invalid Base32 secret");
      secret = clean;
    }

    if (!VALID_ALGORITHMS.includes(algorithm)) return badRequest(`algorithm must be one of: ${VALID_ALGORITHMS.join(", ")}`);
    if (!VALID_DIGITS.includes(digits)) return badRequest("digits must be 6 or 8");
    if (!VALID_PERIODS.includes(period)) return badRequest("period must be 30 or 60");

    const appName = body.appName?.trim();
    if (!appName) return badRequest("appName is required");

    const entry = await prisma.personalTwoFactorEntry.create({
      data: {
        ownerUserId: auth.userId,
        appName,
        issuer,
        accountLabel,
        encryptedSecret: encrypt(secret),
        algorithm,
        digits,
        period,
        notes: body.notes?.trim() ?? null,
      },
      select: { id: true, appName: true, issuer: true, accountLabel: true, algorithm: true, digits: true, period: true, createdAt: true },
    });

    await logPersonalVaultAction({
      userId: auth.userId,
      action: "2fa_created",
      targetType: "2fa",
      targetId: entry.id,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
