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

  const [entries, members] = await Promise.all([
    prisma.twoFactorEntry.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        status: true,
        category: true,
        assignments: { select: { assignedToUserId: true } },
      },
    }),
    prisma.userOrganization.findMany({
      where: { organizationId },
      select: { userId: true },
    }),
  ]);

  const totalMembers = members.length;
  const memberIds = new Set(members.map((m) => m.userId));

  const usersWithTotp = new Set<string>();
  let assigned = 0;

  for (const entry of entries) {
    const assignedUsers = entry.assignments
      .map((a) => a.assignedToUserId)
      .filter((uid): uid is string => uid !== null && memberIds.has(uid));
    if (assignedUsers.length > 0) {
      assigned++;
      assignedUsers.forEach((uid) => usersWithTotp.add(uid));
    }
  }

  const total = entries.length;
  const active = entries.filter((e) => e.status === "active").length;
  const unassigned = total - assigned;

  return NextResponse.json({
    rows: [
      {
        category: "TOTP / 2FA Entries",
        total,
        active,
        assigned,
        unassigned,
        membersWithTotp: usersWithTotp.size,
        membersMissingTotp: totalMembers - usersWithTotp.size,
        status:
          total === 0
            ? "Not Configured"
            : unassigned === 0
            ? "Active"
            : unassigned === total
            ? "Not Assigned"
            : "Partially Assigned",
      },
    ],
  });
}
