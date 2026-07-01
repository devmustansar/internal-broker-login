import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isPublicOnboardingEnabled,
  disabledResponse,
  checkRateLimit,
  rateLimitedResponse,
  deriveMemberStatus,
} from "@/lib/public-onboarding";

export async function GET(req: NextRequest) {
  if (!isPublicOnboardingEnabled()) return disabledResponse();
  if (!checkRateLimit(req)) return rateLimitedResponse();

  const [
    totalOrganizations,
    totalTeams,
    totalWebResources,
    totalAwsResources,
    totalCredentials,
    totalTotpEntries,
    allOrgs,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.credentialGroup.count(),
    prisma.resource.count({ where: { isActive: true } }),
    prisma.awsResource.count({ where: { isActive: true } }),
    prisma.sharedCredential.count(),
    prisma.twoFactorEntry.count({ where: { deletedAt: null, status: "active" } }),
    prisma.organization.findMany({
      select: { id: true, updatedAt: true },
    }),
  ]);

  const totalResources = totalWebResources + totalAwsResources;
  const orgIds = allOrgs.map((o) => o.id);

  // Load all members across all orgs
  const allMembers = await prisma.userOrganization.findMany({
    where: { organizationId: { in: orgIds } },
    select: { userId: true, organizationId: true },
    distinct: ["userId"],
  });

  const totalMembers = allMembers.length;
  const memberUserIds = allMembers.map((m) => m.userId);

  // Per-member counts
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
      where: { assignedToUserId: { in: memberUserIds } },
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

  const orgHasCreds = totalCredentials > 0;
  const orgHasTotp = totalTotpEntries > 0;

  let fullyOnboardedMembers = 0;
  let partiallyOnboardedMembers = 0;
  let pendingMembers = 0;
  const blockedMembers = 0;

  for (const { userId } of allMembers) {
    const status = deriveMemberStatus(
      usersWithResources.has(userId),
      usersWithCreds.has(userId),
      orgHasCreds,
      usersWithTotp.has(userId),
      orgHasTotp,
      usersWithSession.has(userId)
    );
    if (status === "fully_onboarded") fullyOnboardedMembers++;
    else if (status === "partially_onboarded") partiallyOnboardedMembers++;
    else pendingMembers++;
  }

  const overallProgressPercent =
    totalMembers === 0
      ? 0
      : Math.round((fullyOnboardedMembers / totalMembers) * 100);

  const lastUpdatedAt =
    allOrgs.reduce<Date>(
      (latest, o) => (o.updatedAt > latest ? o.updatedAt : latest),
      new Date(0)
    ).toISOString();

  return NextResponse.json({
    totalOrganizations,
    totalTeams,
    totalMembers,
    totalResources,
    totalCredentials,
    totalTotpEntries,
    fullyOnboardedMembers,
    partiallyOnboardedMembers,
    pendingMembers,
    blockedMembers,
    overallProgressPercent,
    lastUpdatedAt,
  });
}
