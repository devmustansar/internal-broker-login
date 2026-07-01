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

  const [credentials, members] = await Promise.all([
    prisma.sharedCredential.findMany({
      where: { organizationId },
      select: {
        id: true,
        shares: { select: { userId: true } },
        groups: {
          select: {
            group: { select: { members: { select: { userId: true } } } },
          },
        },
      },
    }),
    prisma.userOrganization.findMany({
      where: { organizationId },
      select: { userId: true },
    }),
  ]);

  const totalMembers = members.length;
  const memberIds = new Set(members.map((m) => m.userId));

  // Who has access to at least one credential?
  const usersWithAccess = new Set<string>();
  let assigned = 0;
  for (const cred of credentials) {
    const directUsers = cred.shares.map((s) => s.userId);
    const groupUsers = cred.groups.flatMap((ge) =>
      ge.group.members.map((m) => m.userId)
    );
    const allUsers = new Set([...directUsers, ...groupUsers]);
    const orgUsers = [...allUsers].filter((uid) => memberIds.has(uid));
    if (orgUsers.length > 0) {
      assigned++;
      orgUsers.forEach((uid) => usersWithAccess.add(uid));
    }
  }

  const total = credentials.length;
  const unassigned = total - assigned;
  const membersWithCredentials = usersWithAccess.size;
  const membersMissingCredentials = totalMembers - membersWithCredentials;

  return NextResponse.json({
    rows: [
      {
        category: "Shared Credentials",
        total,
        assigned,
        unassigned,
        membersWithCredentials,
        membersMissingCredentials,
        status:
          total === 0
            ? "Not Configured"
            : unassigned === 0 && membersWithCredentials === totalMembers
            ? "Active"
            : unassigned > 0
            ? "Not Assigned"
            : "Needs Review",
      },
    ],
  });
}
