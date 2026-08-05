import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, unauthorized, serverError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/organizations
 * Lists organizations the current user belongs to (id + name only).
 * Unlike /api/admin/organizations, this is available to plain members —
 * used to populate the "Request Credential / 2FA" organization picker.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const orgs = await prisma.organization.findMany({
      where: { id: { in: auth.organizationIds || [] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(orgs);
  } catch (err) {
    return serverError(err);
  }
}
