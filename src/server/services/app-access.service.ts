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

  canUserAccessResource(user: InternalUser, resourceKey: string): boolean {
    if (user.allowedResourceKeys.includes("*")) return true;
    return user.allowedResourceKeys.includes(resourceKey);
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
