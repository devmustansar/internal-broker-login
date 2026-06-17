import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { canManageOrg, getOrgFilter, isSuperAdmin } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import {
  encryptSecret,
  parseOtpAuthUri,
  logManagementAction,
} from "@/server/services/two-factor.service";

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
 * GET /api/admin/2fa?organizationId=&search=&category=&environment=&status=&page=&pageSize=
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const p = req.nextUrl.searchParams;
    const orgId = p.get("organizationId");
    const search = p.get("search") ?? "";
    const category = p.get("category");
    const environment = p.get("environment");
    const status = p.get("status");
    const page = Math.max(0, parseInt(p.get("page") ?? "0", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(p.get("pageSize") ?? "25", 10)));

    const orgFilter = orgId
      ? { organizationId: orgId }
      : getOrgFilter(auth);

    if (orgId && !isSuperAdmin(auth) && !canManageOrg(auth, orgId)) {
      return forbidden();
    }

    const where: any = {
      ...orgFilter,
      deletedAt: null,
      ...(category ? { category } : {}),
      ...(environment ? { environment } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { appName: { contains: search, mode: "insensitive" } },
              { issuer: { contains: search, mode: "insensitive" } },
              { accountLabel: { contains: search, mode: "insensitive" } },
              { category: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.twoFactorEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page * pageSize,
        take: pageSize,
        select: {
          id: true,
          appName: true,
          issuer: true,
          accountLabel: true,
          algorithm: true,
          digits: true,
          period: true,
          category: true,
          environment: true,
          notes: true,
          allowNotesForUsers: true,
          status: true,
          organizationId: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          resourceId: true,
          awsResourceId: true,
          credentialId: true,
          resource: { select: { id: true, name: true, resourceKey: true } },
          awsResource: { select: { id: true, name: true, resourceKey: true } },
          credential: { select: { id: true, appName: true } },
          _count: { select: { assignments: true } },
        },
      }),
      prisma.twoFactorEntry.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(({ _count, resource, awsResource, credential, ...rest }) => ({
        ...rest,
        assignmentCount: _count.assignments,
        resourceName: resource?.name ?? null,
        resourceKey: resource?.resourceKey ?? null,
        awsResourceName: awsResource?.name ?? null,
        awsResourceKey: awsResource?.resourceKey ?? null,
        credentialAppName: credential?.appName ?? null,
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/admin/2fa
 * inputMode: "manual" | "uri"
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const { organizationId, inputMode = "manual" } = body;

    if (!organizationId) return badRequest("organizationId is required");
    if (!canManageOrg(auth, organizationId)) return forbidden();

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

    if (!VALID_ALGORITHMS.includes(algorithm)) {
      return badRequest(`algorithm must be one of: ${VALID_ALGORITHMS.join(", ")}`);
    }
    if (!VALID_DIGITS.includes(digits)) return badRequest("digits must be 6 or 8");
    if (!VALID_PERIODS.includes(period)) return badRequest("period must be 30 or 60");

    const appName = body.appName?.trim();
    if (!appName) return badRequest("appName is required");

    const encryptedSecret = encryptSecret(secret);

    const entry = await prisma.twoFactorEntry.create({
      data: {
        organizationId,
        appName,
        issuer: issuer ?? null,
        accountLabel: accountLabel ?? null,
        encryptedSecret,
        algorithm,
        digits,
        period,
        category: body.category?.trim() ?? null,
        environment: body.environment ?? null,
        notes: body.notes?.trim() ?? null,
        allowNotesForUsers: body.allowNotesForUsers ?? false,
        status: body.status ?? "active",
        createdById: auth.userId,
        ownerId: auth.userId,
        resourceId: body.resourceId ?? null,
        awsResourceId: body.awsResourceId ?? null,
        credentialId: body.credentialId ?? null,
      },
      select: {
        id: true,
        appName: true,
        issuer: true,
        accountLabel: true,
        algorithm: true,
        digits: true,
        period: true,
        category: true,
        environment: true,
        status: true,
        organizationId: true,
        createdAt: true,
      },
    });

    await logManagementAction({
      action: "2fa_entry_created",
      userId: auth.userId,
      organizationId,
      details: { entryId: entry.id, appName: entry.appName },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
