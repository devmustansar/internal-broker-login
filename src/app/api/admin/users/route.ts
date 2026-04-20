import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, canManageOrg, isSuperAdmin } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    if (!data.email || !data.name || !data.role) {
      return badRequest("Missing required fields (email, name, role)");
    }

    // Only super_admin can create other super_admins
    if (data.role === "super_admin" && !isSuperAdmin(auth)) {
      return forbidden("Only super admins can create super admin users");
    }

    // Validate org assignments — admin can only assign their own orgs
    const organizationIds: string[] = data.organizationIds || [];
    if (!isSuperAdmin(auth)) {
      for (const orgId of organizationIds) {
        if (!canManageOrg(auth, orgId)) {
          return forbidden(`You do not have access to organization ${orgId}`);
        }
      }
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        allowedResourceKeys: data.allowedResourceKeys || [],
        passwordHash: data.password || "password123",
        organizations: {
          create: organizationIds.map((orgId: string) => ({
            organizationId: orgId,
          })),
        },
      },
      include: {
        organizations: {
          include: { organization: true },
        },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
