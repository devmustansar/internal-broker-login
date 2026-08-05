import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "vault_request_created"
  | "vault_request_approved"
  | "vault_request_rejected"
  | "vault_request_completed";

/** Fans a notification out to a set of user ids (deduplicated, self-notifications skipped by caller if desired). */
export async function notifyUsers(
  userIds: string[],
  opts: { type: NotificationType; title: string; body?: string; relatedId?: string }
): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) return;

  await prisma.notification.createMany({
    data: uniqueIds.map((userId) => ({
      userId,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      relatedId: opts.relatedId ?? null,
    })),
  });
}

/**
 * Resolves the set of user ids who should be notified about activity on a VaultRequest:
 * org owners, org admins, and the resource owner (if a resource/aws resource was selected).
 */
export async function getVaultRequestStakeholderIds(opts: {
  organizationId: string;
  resourceOwnerUserId?: string | null;
  awsResourceOwnerUserId?: string | null;
}): Promise<string[]> {
  const orgAdmins = await prisma.userOrganization.findMany({
    where: { organizationId: opts.organizationId, role: { in: ["owner", "admin"] } },
    select: { userId: true },
  });

  const ids = orgAdmins.map((m) => m.userId);
  if (opts.resourceOwnerUserId) ids.push(opts.resourceOwnerUserId);
  if (opts.awsResourceOwnerUserId) ids.push(opts.awsResourceOwnerUserId);
  return ids;
}
