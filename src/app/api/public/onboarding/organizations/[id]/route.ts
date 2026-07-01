import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isPublicOnboardingEnabled,
  disabledResponse,
  checkRateLimit,
  rateLimitedResponse,
  deriveOnboardingStatus,
  deriveMemberStatus,
} from "@/lib/public-onboarding";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isPublicOnboardingEnabled()) return disabledResponse();
  if (!checkRateLimit(req)) return rateLimitedResponse();

  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      users: { select: { userId: true, role: true } },
      resources: { where: { isActive: true }, select: { id: true } },
      awsResources: { where: { isActive: true }, select: { id: true } },
      sharedCredentials: { select: { id: true } },
      twoFactorEntries: {
        where: { deletedAt: null, status: "active" },
        select: { id: true },
      },
      credentialGroups: { select: { id: true } },
    },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memberUserIds = org.users.map((u) => u.userId);
  const orgHasCreds = org.sharedCredentials.length > 0;
  const orgHasTotp = org.twoFactorEntries.length > 0;

  const [resourceAccess, credAccess, groupAccess, totpAssignments, sessions] = await Promise.all([
    prisma.userResourceAccess.findMany({
      where: { userId: { in: memberUserIds } },
      select: { userId: true },
    }),
    prisma.credentialShare.findMany({
      where: { userId: { in: memberUserIds } },
      select: { userId: true },
    }),
    prisma.credentialGroupMember.findMany({
      where: { userId: { in: memberUserIds } },
      select: { userId: true },
    }),
    prisma.twoFactorAssignment.findMany({
      where: { organizationId: id, assignedToUserId: { in: memberUserIds } },
      select: { assignedToUserId: true },
    }),
    prisma.brokerSession.findMany({
      where: { userId: { in: memberUserIds } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const usersWithResources = new Set(resourceAccess.map((r) => r.userId));
  const usersWithCreds = new Set([
    ...credAccess.map((c) => c.userId),
    ...groupAccess.map((g) => g.userId),
  ]);
  const usersWithTotp = new Set(
    totpAssignments.map((t) => t.assignedToUserId).filter(Boolean) as string[]
  );
  const usersWithSession = new Set(sessions.map((s) => s.userId));

  let fully = 0, partially = 0, pending = 0;
  for (const { userId } of org.users) {
    const s = deriveMemberStatus(
      usersWithResources.has(userId),
      usersWithCreds.has(userId),
      orgHasCreds,
      usersWithTotp.has(userId),
      orgHasTotp,
      usersWithSession.has(userId)
    );
    if (s === "fully_onboarded") fully++;
    else if (s === "partially_onboarded") partially++;
    else pending++;
  }

  const membersCount = org.users.length;
  const progressPercent = membersCount === 0 ? 0 : Math.round((fully / membersCount) * 100);

  return NextResponse.json({
    organizationId: org.id,
    organizationName: org.name,
    teamsCount: org.credentialGroups.length,
    membersCount,
    resourcesCount: org.resources.length + org.awsResources.length,
    credentialsCount: org.sharedCredentials.length,
    totpCount: org.twoFactorEntries.length,
    membersWithResources: usersWithResources.size,
    membersWithCredentials: usersWithCreds.size,
    membersWithTotp: usersWithTotp.size,
    unassignedMembers: pending,
    fullyOnboardedMembers: fully,
    partiallyOnboardedMembers: partially,
    pendingMembers: pending,
    blockedMembers: 0,
    progressPercent,
    status: deriveOnboardingStatus(progressPercent),
    lastUpdatedAt: org.updatedAt.toISOString(),
  });
}
