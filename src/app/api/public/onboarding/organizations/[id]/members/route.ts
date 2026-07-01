import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isPublicOnboardingEnabled,
  disabledResponse,
  checkRateLimit,
  rateLimitedResponse,
  deriveMemberStatus,
  anonymizeLabel,
} from "@/lib/public-onboarding";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isPublicOnboardingEnabled()) return disabledResponse();
  if (!checkRateLimit(req)) return rateLimitedResponse();

  const { id: organizationId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      sharedCredentials: { select: { id: true } },
      twoFactorEntries: { where: { deletedAt: null, status: "active" }, select: { id: true } },
    },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgHasCreds = org.sharedCredentials.length > 0;
  const orgHasTotp = org.twoFactorEntries.length > 0;

  const members = await prisma.userOrganization.findMany({
    where: { organizationId },
    select: {
      userId: true,
      role: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true, updatedAt: true } },
    },
    orderBy: { role: "asc" },
  });

  const userIds = members.map((m) => m.userId);

  // Determine team memberships (via credential groups as "teams")
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
      where: { userId: { in: userIds } },
      select: { userId: true },
    }),
    prisma.twoFactorAssignment.findMany({
      where: { organizationId, assignedToUserId: { in: userIds } },
      select: { assignedToUserId: true },
    }),
    prisma.brokerSession.findMany({
      where: { userId: { in: userIds } },
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

  const rows = members.map((m, i) => {
    const hasResources = usersWithResources.has(m.userId);
    const hasCreds = usersWithCreds.has(m.userId);
    const hasTotp = usersWithTotp.has(m.userId);
    const hasLoggedIn = usersWithSession.has(m.userId);

    const overallStatus = deriveMemberStatus(
      hasResources, hasCreds, orgHasCreds, hasTotp, orgHasTotp, hasLoggedIn
    );

    const missing: string[] = [];
    if (!hasLoggedIn) missing.push("Login not completed");
    if (!hasResources) missing.push("Missing resource assignment");
    if (!hasCreds && orgHasCreds) missing.push("Missing credential assignment");
    if (!hasTotp && orgHasTotp) missing.push("Missing 2FA assignment");

    return {
      memberId: m.userId,
      displayLabel: m.user.name || m.user.email || anonymizeLabel(i, m.role),
      teamName: userTeamMap.get(m.userId) ?? null,
      roleInOrg: m.role,
      deviceStatus: "not_required" as const,
      loginStatus: hasLoggedIn ? ("logged_in" as const) : ("not_logged_in" as const),
      resourceStatus: hasResources
        ? ("assigned" as const)
        : ("not_assigned" as const),
      credentialStatus: !orgHasCreds
        ? ("not_required" as const)
        : hasCreds
        ? ("assigned" as const)
        : ("not_assigned" as const),
      totpStatus: !orgHasTotp
        ? ("not_required" as const)
        : hasTotp
        ? ("assigned" as const)
        : ("not_assigned" as const),
      overallStatus,
      publicMissingItems: missing,
      lastUpdatedAt: m.updatedAt.toISOString(),
    };
  });

  return NextResponse.json(rows);
}
