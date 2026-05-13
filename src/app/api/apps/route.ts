import { NextRequest, NextResponse } from "next/server";
import { appAccessService } from "@/server/services/app-access.service";
import { getAuthContext, unauthorized, serverError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const user = await appAccessService.getUserById(auth.userId);
    if (!user) return unauthorized("User not found");

    // Super admins see everything
    if (user.role === "super_admin") {
      const allWeb = await appAccessService.getAllResources();
      const allAws = await prisma.awsResource.findMany({ where: { isActive: true } });
      return NextResponse.json([...allWeb, ...allAws]);
    }

    // Check if user is an org admin/owner in orgs where allowAdminResourceView is enabled
    const adminOrgIds = Object.entries(auth.orgRoles || {})
      .filter(([, role]) => role === "admin" || role === "owner")
      .map(([orgId]) => orgId);

    if (adminOrgIds.length > 0) {
      const enabledOrgs = await prisma.organization.findMany({
        where: { id: { in: adminOrgIds }, allowAdminResourceView: true },
        select: { id: true },
      });

      if (enabledOrgs.length > 0) {
        const enabledOrgIds = enabledOrgs.map(o => o.id);
        // Collect all user IDs across those orgs
        const orgUserRecords = await prisma.userOrganization.findMany({
          where: { organizationId: { in: enabledOrgIds } },
          select: { userId: true },
        });
        const orgUserIds = [...new Set(orgUserRecords.map(r => r.userId))];

        // Fetch all resource accesses for those users
        const allAccesses = await prisma.userResourceAccess.findMany({
          where: { userId: { in: orgUserIds } },
          include: { resource: true, awsResource: true },
        });

        // Deduplicate by resource ID
        const webMap = new Map<string, (typeof allAccesses)[0]["resource"]>();
        const awsMap = new Map<string, (typeof allAccesses)[0]["awsResource"]>();
        for (const a of allAccesses) {
          if (a.resource?.isActive) webMap.set(a.resource.id, a.resource);
          if (a.awsResource?.isActive) awsMap.set(a.awsResource.id, a.awsResource);
        }

        return NextResponse.json([...webMap.values(), ...awsMap.values()]);
      }
    }

    // Default: return only resources explicitly assigned to this user
    const accesses = await prisma.userResourceAccess.findMany({
      where: { userId: auth.userId },
      include: { resource: true, awsResource: true },
    });

    const accessibleWeb = accesses
      .filter(a => a.resource && a.resource.isActive)
      .map(a => a.resource!);

    const accessibleAws = accesses
      .filter(a => a.awsResource && a.awsResource.isActive)
      .map(a => a.awsResource!);

    return NextResponse.json([...accessibleWeb, ...accessibleAws]);
  } catch (err) {
    return serverError(err);
  }
}
