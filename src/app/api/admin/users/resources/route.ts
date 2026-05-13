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

/**
 * GET /api/admin/users/resources?userId=<id>
 * Returns resources assigned to a specific user.
 * Requires the requester to be:
 *   - super_admin, OR
 *   - org admin/owner in an org where the target user is a member AND allowAdminResourceView is true
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return badRequest("Missing required query param: userId");

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!targetUser) return badRequest("User not found");

    if (!isSuperAdmin(auth)) {
      // Collect orgs where requester is admin/owner AND allowAdminResourceView is true
      const adminOrgIds = Object.entries(auth.orgRoles || {})
        .filter(([, role]) => role === "admin" || role === "owner")
        .map(([orgId]) => orgId);

      if (adminOrgIds.length === 0) return forbidden("Insufficient permissions");

      const enabledOrgs = await prisma.organization.findMany({
        where: { id: { in: adminOrgIds }, allowAdminResourceView: true },
        select: { id: true },
      });

      if (enabledOrgs.length === 0) {
        return forbidden("Admin resource view is not enabled for your organizations");
      }

      const enabledOrgIds = enabledOrgs.map((o) => o.id);

      // Verify target user is a member of at least one enabled org
      const sharedOrg = await prisma.userOrganization.findFirst({
        where: { userId, organizationId: { in: enabledOrgIds } },
      });

      if (!sharedOrg) {
        return forbidden("Target user is not a member of any organization you manage");
      }
    }

    const accesses = await prisma.userResourceAccess.findMany({
      where: { userId },
      include: {
        resource: true,
        awsResource: true,
      },
    });

    const webResources = accesses
      .filter((a) => a.resource?.isActive)
      .map((a) => a.resource!);

    const awsResources = accesses
      .filter((a) => a.awsResource?.isActive)
      .map((a) => a.awsResource!);

    return NextResponse.json({
      user: targetUser,
      resources: [...webResources, ...awsResources],
    });
  } catch (err) {
    return serverError(err);
  }
}
