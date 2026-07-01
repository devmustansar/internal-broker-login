import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isPublicOnboardingEnabled,
  disabledResponse,
  checkRateLimit,
  rateLimitedResponse,
  deriveMemberStatus,
  deriveAssignmentStatus,
  anonymizeLabel,
} from "@/lib/public-onboarding";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isPublicOnboardingEnabled()) return disabledResponse();
  if (!checkRateLimit(req)) return rateLimitedResponse();

  const { id: organizationId } = await params;

  const [org, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        resources: { where: { isActive: true }, select: { id: true } },
        awsResources: { where: { isActive: true }, select: { id: true } },
        sharedCredentials: { select: { id: true } },
        twoFactorEntries: {
          where: { deletedAt: null, status: "active" },
          select: { id: true },
        },
      },
    }),
    prisma.userOrganization.findMany({
      where: { organizationId },
      select: { userId: true, role: true, updatedAt: true },
      orderBy: { role: "asc" },
    }),
  ]);

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalResources = org.resources.length + org.awsResources.length;
  const totalCredentials = org.sharedCredentials.length;
  const totalTotp = org.twoFactorEntries.length;
  const orgHasCreds = totalCredentials > 0;
  const orgHasTotp = totalTotp > 0;

  const userIds = members.map((m) => m.userId);

  // Team memberships
  const groupMemberships = await prisma.credentialGroupMember.findMany({
    where: { userId: { in: userIds }, group: { organizationId } },
    select: { userId: true, group: { select: { name: true } } },
  });
  const userTeamMap = new Map<string, string>();
  for (const gm of groupMemberships) {
    if (!userTeamMap.has(gm.userId)) userTeamMap.set(gm.userId, gm.group.name);
  }

  const [resourceAccess, credAccess, groupAccess, totpAssignments, sessions] = await Promise.all([
    prisma.userResourceAccess.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
    }),
    prisma.credentialShare.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
    }),
    prisma.credentialGroupMember.findMany({
      where: { userId: { in: userIds }, group: { organizationId } },
      select: { userId: true },
    }),
    prisma.twoFactorAssignment.findMany({
      where: { organizationId, assignedToUserId: { in: userIds } },
      select: { assignedToUserId: true, twoFactorEntryId: true },
    }),
    prisma.brokerSession.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  // Count per-user
  const userResourceCount = new Map<string, number>();
  for (const r of resourceAccess) {
    userResourceCount.set(r.userId, (userResourceCount.get(r.userId) ?? 0) + 1);
  }

  const usersWithCreds = new Set([
    ...credAccess.map((c) => c.userId),
    ...groupAccess.map((g) => g.userId),
  ]);

  const userTotpCount = new Map<string, number>();
  for (const t of totpAssignments) {
    if (t.assignedToUserId) {
      userTotpCount.set(t.assignedToUserId, (userTotpCount.get(t.assignedToUserId) ?? 0) + 1);
    }
  }

  const usersWithSession = new Set(sessions.map((s) => s.userId));

  const rows = members.map((m, i) => {
    const assignedResources = userResourceCount.get(m.userId) ?? 0;
    const hasCreds = usersWithCreds.has(m.userId);
    const assignedTotp = userTotpCount.get(m.userId) ?? 0;
    const hasLoggedIn = usersWithSession.has(m.userId);

    const resourceStatus = deriveAssignmentStatus(assignedResources, totalResources);
    const credentialStatus = !orgHasCreds
      ? ("not_required" as const)
      : hasCreds
      ? ("assigned" as const)
      : ("not_assigned" as const);
    const totpStatus = deriveAssignmentStatus(assignedTotp, orgHasTotp ? totalTotp : 0);

    const overallStatus = deriveMemberStatus(
      assignedResources > 0,
      hasCreds,
      orgHasCreds,
      assignedTotp > 0,
      orgHasTotp,
      hasLoggedIn
    );

    const missing: string[] = [];
    if (!hasLoggedIn) missing.push("Login not completed");
    if (assignedResources === 0) missing.push("Missing resource assignment");
    if (!hasCreds && orgHasCreds) missing.push("Missing credential assignment");
    if (assignedTotp === 0 && orgHasTotp) missing.push("Missing 2FA assignment");

    return {
      memberId: m.userId,
      displayLabel: anonymizeLabel(i, m.role),
      teamName: userTeamMap.get(m.userId) ?? null,
      requiredResources: totalResources,
      assignedResources,
      resourceStatus,
      requiredCredentials: orgHasCreds ? 1 : 0,
      assignedCredentials: hasCreds ? 1 : 0,
      credentialStatus,
      requiredTotp: orgHasTotp ? totalTotp : 0,
      assignedTotp,
      totpStatus,
      overallStatus,
      publicMissingItems: missing,
    };
  });

  return NextResponse.json(rows);
}
