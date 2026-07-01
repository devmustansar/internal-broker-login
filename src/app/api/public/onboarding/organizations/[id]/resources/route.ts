import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isPublicOnboardingEnabled,
  disabledResponse,
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/public-onboarding";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isPublicOnboardingEnabled()) return disabledResponse();
  if (!checkRateLimit(req)) return rateLimitedResponse();

  const { id: organizationId } = await params;

  const [webResources, awsResources, orgMembers] = await Promise.all([
    prisma.resource.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        environment: true,
        userAccess: { select: { userId: true } },
        twoFactorEntries: { where: { deletedAt: null }, select: { id: true } },
      },
    }),
    prisma.awsResource.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        environment: true,
        userAccess: { select: { userId: true } },
        twoFactorEntries: { where: { deletedAt: null }, select: { id: true } },
      },
    }),
    prisma.userOrganization.findMany({
      where: { organizationId },
      select: { userId: true },
    }),
  ]);

  const totalMembers = orgMembers.length;
  const webCount = webResources.length;
  const awsCount = awsResources.length;

  const allWebUserIds = new Set(webResources.flatMap((r) => r.userAccess.map((a) => a.userId)));
  const allAwsUserIds = new Set(awsResources.flatMap((r) => r.userAccess.map((a) => a.userId)));
  const allAssignedUserIds = new Set([...allWebUserIds, ...allAwsUserIds]);

  const rows = [
    {
      category: "Web Applications",
      count: webCount,
      assignedTeamsCount: 0,
      assignedMembersCount: allWebUserIds.size,
      status: webCount === 0 ? "Not Configured" : allWebUserIds.size === totalMembers ? "Fully Assigned" : allWebUserIds.size > 0 ? "Partially Assigned" : "Not Assigned",
    },
    {
      category: "AWS Accounts",
      count: awsCount,
      assignedTeamsCount: 0,
      assignedMembersCount: allAwsUserIds.size,
      status: awsCount === 0 ? "Not Configured" : allAwsUserIds.size === totalMembers ? "Fully Assigned" : allAwsUserIds.size > 0 ? "Partially Assigned" : "Not Assigned",
    },
  ].filter((r) => r.count > 0);

  return NextResponse.json({
    totalResources: webCount + awsCount,
    totalAssignedMembers: allAssignedUserIds.size,
    totalMembers,
    rows,
  });
}
