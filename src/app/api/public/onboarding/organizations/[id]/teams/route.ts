import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isPublicOnboardingEnabled,
  disabledResponse,
  checkRateLimit,
  rateLimitedResponse,
  deriveOnboardingStatus,
} from "@/lib/public-onboarding";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isPublicOnboardingEnabled()) return disabledResponse();
  if (!checkRateLimit(req)) return rateLimitedResponse();

  const { id: organizationId } = await params;

  const teams = await prisma.credentialGroup.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      members: { select: { userId: true } },
    },
    orderBy: { name: "asc" },
  });

  const results = await Promise.all(
    teams.map(async (team) => {
      const memberIds = team.members.map((m) => m.userId);
      if (memberIds.length === 0) {
        return {
          teamId: team.id,
          teamName: team.name,
          totalMembers: 0,
          membersWithResources: 0,
          membersWithCredentials: 0,
          membersWithTotp: 0,
          fullyOnboardedMembers: 0,
          pendingMembers: 0,
          progressPercent: 0,
          status: "not_started" as const,
        };
      }

      const [resourceAccess, credAccess, totpAssignments, sessions] = await Promise.all([
        prisma.userResourceAccess.findMany({
          where: { userId: { in: memberIds } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.credentialShare.findMany({
          where: { userId: { in: memberIds } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.twoFactorAssignment.findMany({
          where: { organizationId, assignedToUserId: { in: memberIds } },
          select: { assignedToUserId: true },
          distinct: ["assignedToUserId"],
        }),
        prisma.brokerSession.findMany({
          where: { userId: { in: memberIds } },
          select: { userId: true },
          distinct: ["userId"],
        }),
      ]);

      const withResources = new Set(resourceAccess.map((r) => r.userId));
      const withCreds = new Set(credAccess.map((c) => c.userId));
      const withTotp = new Set(
        totpAssignments.map((t) => t.assignedToUserId).filter(Boolean) as string[]
      );
      const withSession = new Set(sessions.map((s) => s.userId));

      let fully = 0;
      for (const uid of memberIds) {
        if (withResources.has(uid) && withSession.has(uid)) fully++;
      }

      const total = memberIds.length;
      const progressPercent = total === 0 ? 0 : Math.round((fully / total) * 100);

      return {
        teamId: team.id,
        teamName: team.name,
        totalMembers: total,
        membersWithResources: withResources.size,
        membersWithCredentials: withCreds.size,
        membersWithTotp: withTotp.size,
        fullyOnboardedMembers: fully,
        pendingMembers: total - fully,
        progressPercent,
        status: deriveOnboardingStatus(progressPercent),
      };
    })
  );

  return NextResponse.json(results);
}
