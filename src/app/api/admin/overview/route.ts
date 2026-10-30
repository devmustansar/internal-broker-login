import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, unauthorized, forbidden, serverError } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

const userSelect = { id: true, name: true, email: true } as const;

/**
 * GET /api/admin/overview
 * Super admins only. Organization-by-organization snapshot of what exists and
 * who can reach it: resources (web + AWS), shared credentials and 2FA entries,
 * each with the users that have access. Resources with no organization are
 * grouped under a synthetic "Unassigned" entry. Never returns secrets.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isSuperAdmin(auth)) return forbidden("Super admin access required");

    const [orgs, webResources, awsResources, credentials, twoFactor] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          users: { select: { role: true, user: { select: userSelect } } },
        },
      }),
      prisma.resource.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true, resourceKey: true, name: true, environment: true, isActive: true,
          loginAdapter: true, organizationId: true,
          userAccess: { select: { user: { select: userSelect } } },
        },
      }),
      prisma.awsResource.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true, resourceKey: true, name: true, environment: true, isActive: true,
          awsAccountId: true, organizationId: true,
          userAccess: { select: { user: { select: userSelect } } },
        },
      }),
      prisma.sharedCredential.findMany({
        orderBy: { appName: "asc" },
        select: {
          id: true, appName: true, loginUrl: true, organizationId: true,
          shares: { select: { user: { select: userSelect } } },
          groups: {
            select: {
              group: {
                select: { name: true, members: { select: { user: { select: userSelect } } } },
              },
            },
          },
        },
      }),
      prisma.twoFactorEntry.findMany({
        where: { deletedAt: null, status: "active" },
        orderBy: { appName: "asc" },
        select: {
          id: true, appName: true, issuer: true, accountLabel: true, organizationId: true,
          assignments: { select: { assignedToUser: { select: userSelect } } },
        },
      }),
    ]);

    // De-duplicate users reached through several paths (e.g. direct share + group).
    const uniqueUsers = (users: Array<{ id: string; name: string; email: string } | null | undefined>) => {
      const map = new Map<string, { id: string; name: string; email: string }>();
      for (const u of users) if (u) map.set(u.id, u);
      return [...map.values()];
    };

    const buildBucket = (organizationId: string | null) => ({
      resources: [
        ...webResources
          .filter((r) => r.organizationId === organizationId)
          .map((r) => ({
            id: r.id, kind: "web" as const, resourceKey: r.resourceKey, name: r.name,
            environment: r.environment, isActive: r.isActive, detail: r.loginAdapter,
            users: uniqueUsers(r.userAccess.map((a) => a.user)),
          })),
        ...awsResources
          .filter((r) => r.organizationId === organizationId)
          .map((r) => ({
            id: r.id, kind: "aws" as const, resourceKey: r.resourceKey, name: r.name,
            environment: r.environment, isActive: r.isActive, detail: `AWS ${r.awsAccountId}`,
            users: uniqueUsers(r.userAccess.map((a) => a.user)),
          })),
      ],
      credentials: credentials
        .filter((c) => c.organizationId === organizationId)
        .map((c) => ({
          id: c.id, appName: c.appName, loginUrl: c.loginUrl,
          groups: c.groups.map((g) => g.group.name),
          users: uniqueUsers([
            ...c.shares.map((s) => s.user),
            ...c.groups.flatMap((g) => g.group.members.map((m) => m.user)),
          ]),
        })),
      twoFactor: twoFactor
        .filter((t) => t.organizationId === organizationId)
        .map((t) => ({
          id: t.id, appName: t.appName, issuer: t.issuer, accountLabel: t.accountLabel,
          users: uniqueUsers(t.assignments.map((a) => a.assignedToUser)),
        })),
    });

    const organizations = orgs.map((o) => ({
      id: o.id,
      name: o.name,
      description: o.description,
      members: o.users.map((m) => ({ ...m.user, role: m.role })),
      ...buildBucket(o.id),
    }));

    const unassigned = buildBucket(null);
    if (unassigned.resources.length > 0) {
      organizations.push({
        id: "__unassigned__",
        name: "No organization",
        description: "Resources not linked to any organization",
        members: [],
        ...unassigned,
      });
    }

    const totals = {
      organizations: orgs.length,
      resources: webResources.length + awsResources.length,
      credentials: credentials.length,
      twoFactor: twoFactor.length,
      users: await prisma.user.count(),
    };

    return NextResponse.json({ totals, organizations });
  } catch (err) {
    return serverError(err);
  }
}
