import type { InternalUser, ManagedAccount, Resource } from "@/types";
import { prisma } from "@/lib/prisma";

// ─── App Access Service ───────────────────────────────────────────────────────
// Handles resource lookups and access control checks using Postgres (Prisma)

export const appAccessService = {
  async getAllResources(): Promise<Resource[]> {
    const resources = await prisma.resource.findMany({
      where: { isActive: true },
    });
    return resources as any;
  },

  async getResourceByKey(resourceKey: string): Promise<Resource | null> {
    const resource = await prisma.resource.findUnique({
      where: { resourceKey, isActive: true },
    });
    return resource as any;
  },

  async getManagedAccountForResource(resourceId: string): Promise<ManagedAccount | null> {
    const ma = await prisma.managedAccount.findFirst({
      where: { resourceId, isActive: true },
    });
    return ma as any;
  },

  /**
   * Check if a user has access to a resource via the UserResourceAccess table.
   * Super-admins with role "super_admin" bypass this check elsewhere.
   */
  async canUserAccessResource(userId: string, resourceKey: string): Promise<boolean> {
    // Look up the resource in both tables
    const webResource = await prisma.resource.findUnique({ where: { resourceKey } });
    const awsResource = webResource ? null : await prisma.awsResource.findUnique({ where: { resourceKey } });

    if (!webResource && !awsResource) return false;

    const access = await prisma.userResourceAccess.findFirst({
      where: {
        userId,
        ...(webResource ? { resourceId: webResource.id } : { awsResourceId: awsResource!.id }),
      },
    });

    return !!access;
  },

  /**
   * Get all resource keys the user has access to via UserResourceAccess.
   */
  async getUserResourceKeys(userId: string): Promise<string[]> {
    const accesses = await prisma.userResourceAccess.findMany({
      where: { userId },
      include: {
        resource: { select: { resourceKey: true } },
        awsResource: { select: { resourceKey: true } },
      },
    });

    return accesses.map(a => a.resource?.resourceKey || a.awsResource?.resourceKey || "").filter(Boolean);
  },

  async getUserById(userId: string): Promise<InternalUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    return user as any;
  },

  async getUserByEmail(email: string): Promise<InternalUser | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    return user as any;
  },
};
