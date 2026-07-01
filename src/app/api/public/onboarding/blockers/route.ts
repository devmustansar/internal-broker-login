import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isPublicOnboardingEnabled,
  disabledResponse,
  checkRateLimit,
  rateLimitedResponse,
  anonymizeLabel,
} from "@/lib/public-onboarding";

export async function GET(req: NextRequest) {
  if (!isPublicOnboardingEnabled()) return disabledResponse();
  if (!checkRateLimit(req)) return rateLimitedResponse();

  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      users: { select: { userId: true, role: true, user: { select: { name: true, email: true } } } },
      resources: { where: { isActive: true }, select: { id: true } },
      awsResources: { where: { isActive: true }, select: { id: true } },
      sharedCredentials: { select: { id: true } },
      twoFactorEntries: {
        where: { deletedAt: null, status: "active" },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const blockers: Array<{
    organizationName: string;
    teamName: string | null;
    displayLabel: string;
    blockerType: string;
    description: string;
    priority: "high" | "medium" | "low";
    status: "open";
  }> = [];

  for (const org of orgs) {
    const memberIds = org.users.map((u) => u.userId);
    const orgHasResources = org.resources.length + org.awsResources.length > 0;
    const orgHasCreds = org.sharedCredentials.length > 0;
    const orgHasTotp = org.twoFactorEntries.length > 0;

    if (memberIds.length === 0) continue;

    const [resourceAccess, credAccess, groupAccess, totpAssignments, sessions, groupMemberships] =
      await Promise.all([
        prisma.userResourceAccess.findMany({
          where: { userId: { in: memberIds } },
          select: { userId: true },
        }),
        prisma.credentialShare.findMany({
          where: { userId: { in: memberIds } },
          select: { userId: true },
        }),
        prisma.credentialGroupMember.findMany({
          where: { userId: { in: memberIds }, group: { organizationId: org.id } },
          select: { userId: true },
        }),
        prisma.twoFactorAssignment.findMany({
          where: { organizationId: org.id, assignedToUserId: { in: memberIds } },
          select: { assignedToUserId: true },
        }),
        prisma.brokerSession.findMany({
          where: { userId: { in: memberIds } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.credentialGroupMember.findMany({
          where: { userId: { in: memberIds }, group: { organizationId: org.id } },
          select: { userId: true, group: { select: { name: true } } },
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

    const userTeamMap = new Map<string, string>();
    for (const gm of groupMemberships) {
      if (!userTeamMap.has(gm.userId)) userTeamMap.set(gm.userId, gm.group.name);
    }

    org.users.forEach(({ userId, role, user }, i) => {
      const label = user.name || user.email || anonymizeLabel(i, role);
      const teamName = userTeamMap.get(userId) ?? null;

      if (!usersWithSession.has(userId)) {
        blockers.push({
          organizationName: org.name,
          teamName,
          displayLabel: label,
          blockerType: "Login Pending",
          description: "Member has not logged in yet.",
          priority: "high",
          status: "open",
        });
      }

      if (orgHasResources && !usersWithResources.has(userId)) {
        blockers.push({
          organizationName: org.name,
          teamName,
          displayLabel: label,
          blockerType: "Missing Resource Assignment",
          description: "Member has no resources assigned.",
          priority: "high",
          status: "open",
        });
      }

      if (orgHasCreds && !usersWithCreds.has(userId)) {
        blockers.push({
          organizationName: org.name,
          teamName,
          displayLabel: label,
          blockerType: "Missing Credential Assignment",
          description: "Member has no credentials assigned.",
          priority: "medium",
          status: "open",
        });
      }

      if (orgHasTotp && !usersWithTotp.has(userId)) {
        blockers.push({
          organizationName: org.name,
          teamName,
          displayLabel: label,
          blockerType: "Missing 2FA Assignment",
          description: "Member has no 2FA entries assigned.",
          priority: "medium",
          status: "open",
        });
      }
    });
  }

  return NextResponse.json(blockers);
}
