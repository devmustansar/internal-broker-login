import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, isSuperAdmin, getOrgFilter } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import { encryptPayload } from "@/server/secrets/encryption";

/**
 * GET /api/admin/credentials
 * List credentials for the admin's orgs (metadata only — encrypted payload is never returned).
 * Optionally filter by ?organizationId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const orgId = req.nextUrl.searchParams.get("organizationId");
    const orgFilter = orgId ? { organizationId: orgId } : getOrgFilter(auth);

    const credentials = await prisma.sharedCredential.findMany({
      where: orgFilter,
      select: {
        id: true,
        appName: true,
        loginUrl: true,
        description: true,
        organizationId: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        groups: {
          include: {
            group: { select: { id: true, name: true } },
          },
        },
        shares: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(credentials);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/admin/credentials
 * Create a new shared credential. Encrypts { username, password } before saving.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    const { appName, loginUrl, description, username, password, organizationId } = data;

    if (!appName || !username || !password || !organizationId) {
      return badRequest("Missing required fields: appName, username, password, organizationId");
    }

    // Encrypt the sensitive payload
    const encryptedPayload = encryptPayload({ username, password });

    const credential = await prisma.sharedCredential.create({
      data: {
        appName,
        loginUrl: loginUrl || null,
        description: description || null,
        encryptedPayload,
        organizationId,
        createdBy: auth.userId,
      },
      select: {
        id: true,
        appName: true,
        loginUrl: true,
        description: true,
        organizationId: true,
        createdBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json(credential, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
