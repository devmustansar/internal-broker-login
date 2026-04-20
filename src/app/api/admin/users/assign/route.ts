import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, isSuperAdmin } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    const { email, resourceKey } = data;

    if (!email || !resourceKey) {
      return badRequest("Missing required fields (email, resourceKey)");
    }

    // Verify the resource exists and belongs to an org the admin manages
    if (!isSuperAdmin(auth)) {
      const resource =
        (await prisma.resource.findUnique({ where: { resourceKey } })) ||
        (await prisma.awsResource.findUnique({ where: { resourceKey } }));

      if (!resource) return badRequest("Resource not found: " + resourceKey);

      const orgId = (resource as any).organizationId;
      if (orgId && !(auth.organizationIds || []).includes(orgId)) {
        return forbidden(
          "You can only assign resources from your own organizations"
        );
      }
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return badRequest("User not found: " + email);
    }

    // For non-super-admins: verify the target user shares at least one org
    if (!isSuperAdmin(auth)) {
      const sharedOrgs = await prisma.userOrganization.findMany({
        where: {
          userId: user.id,
          organizationId: { in: auth.organizationIds || [] },
        },
      });
      if (sharedOrgs.length === 0) {
        return forbidden(
          "You can only assign resources to team members within your organizations"
        );
      }
    }

    if (
      user.allowedResourceKeys.includes("*") ||
      user.allowedResourceKeys.includes(resourceKey)
    ) {
      return NextResponse.json(
        { message: "User already has access to this resource" },
        { status: 200 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        allowedResourceKeys: {
          push: resourceKey,
        },
      },
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (err) {
    return serverError(err);
  }
}
