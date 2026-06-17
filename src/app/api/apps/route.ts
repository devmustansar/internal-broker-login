import { NextRequest, NextResponse } from "next/server";
import { appAccessService } from "@/server/services/app-access.service";
import { getAuthContext, unauthorized, serverError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

async function attachTwoFactorCounts(resources: any[]): Promise<any[]> {
  if (resources.length === 0) return resources;

  const webIds = resources.filter(r => !r.roleArn).map(r => r.id);
  const awsIds = resources.filter(r => !!r.roleArn).map(r => r.id);

  const [webCounts, awsCounts] = await Promise.all([
    webIds.length > 0
      ? prisma.twoFactorEntry.groupBy({
          by: ["resourceId"],
          where: { resourceId: { in: webIds }, deletedAt: null, status: "active" },
          _count: { id: true },
        })
      : Promise.resolve([]),
    awsIds.length > 0
      ? prisma.twoFactorEntry.groupBy({
          by: ["awsResourceId"],
          where: { awsResourceId: { in: awsIds }, deletedAt: null, status: "active" },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const webCountMap = new Map(webCounts.map(r => [r.resourceId!, r._count.id]));
  const awsCountMap = new Map(awsCounts.map(r => [r.awsResourceId!, r._count.id]));

  return resources.map(r => ({
    ...r,
    twoFactorCount: r.roleArn
      ? (awsCountMap.get(r.id) ?? 0)
      : (webCountMap.get(r.id) ?? 0),
  }));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const user = await appAccessService.getUserById(auth.userId);
    if (!user) return unauthorized("User not found");

    let resources: any[];

    // Super admins see everything
    if (user.role === "super_admin") {
      const allWeb = await appAccessService.getAllResources();
      const allAws = await prisma.awsResource.findMany({ where: { isActive: true } });
      resources = [...allWeb, ...allAws];
    } else {
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
          const orgUserRecords = await prisma.userOrganization.findMany({
            where: { organizationId: { in: enabledOrgIds } },
            select: { userId: true },
          });
          const orgUserIds = [...new Set(orgUserRecords.map(r => r.userId))];

          const allAccesses = await prisma.userResourceAccess.findMany({
            where: { userId: { in: orgUserIds } },
            include: { resource: true, awsResource: true },
          });

          const webMap = new Map<string, (typeof allAccesses)[0]["resource"]>();
          const awsMap = new Map<string, (typeof allAccesses)[0]["awsResource"]>();
          for (const a of allAccesses) {
            if (a.resource?.isActive) webMap.set(a.resource.id, a.resource);
            if (a.awsResource?.isActive) awsMap.set(a.awsResource.id, a.awsResource);
          }

          resources = [...webMap.values(), ...awsMap.values()];
        } else {
          resources = await getUserResources(auth.userId);
        }
      } else {
        resources = await getUserResources(auth.userId);
      }
    }

    return NextResponse.json(await attachTwoFactorCounts(resources));
  } catch (err) {
    return serverError(err);
  }
}

async function getUserResources(userId: string) {
  const accesses = await prisma.userResourceAccess.findMany({
    where: { userId },
    include: { resource: true, awsResource: true },
  });

  const web = accesses.filter(a => a.resource && a.resource.isActive).map(a => a.resource!);
  const aws = accesses.filter(a => a.awsResource && a.awsResource.isActive).map(a => a.awsResource!);
  return [...web, ...aws];
}
