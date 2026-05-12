import type { BrokerSession, BrokerSessionStatus } from "@/types";
import { prisma } from "@/lib/prisma";
import { SESSION_TTL_SECONDS } from "@/lib/constants";

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface ISessionRepository {
  create(session: BrokerSession): Promise<void>;
  get(brokerSessionId: string): Promise<BrokerSession | null>;
  update(brokerSessionId: string, patch: Partial<BrokerSession>): Promise<void>;
  end(brokerSessionId: string): Promise<void>;
  listByUser(internalUserId: string): Promise<BrokerSession[]>;
}

// ─── Postgres Session Repository ───────────────────────────────────────────────

class PostgresSessionRepository implements ISessionRepository {
  async create(session: BrokerSession): Promise<void> {
    const resource = await prisma.resource.findUnique({
      where: { resourceKey: session.resourceKey || '' },
    });
    const account = await prisma.managedAccount.findFirst({
      where: { accountKey: session.managedAccountKey, resourceId: resource?.id },
    });

    if (!resource || !account) {
      throw new Error("Resource or ManagedAccount not found for session creation");
    }

    await prisma.brokerSession.create({
      data: {
        brokerSessionId: session.brokerSessionId,
        userId: session.internalUserId,
        resourceId: resource.id,
        managedAccountId: account.id,
        upstreamCookies: session.upstreamCookies as any,
        status: session.status,
        expiresAt: new Date(session.expiresAt),
      },
    });
  }

  async get(brokerSessionId: string): Promise<BrokerSession | null> {
    const session = await prisma.brokerSession.findUnique({
      where: { brokerSessionId },
      include: { resource: true, managedAccount: true },
    });

    if (!session) return null;

    return {
      brokerSessionId: session.brokerSessionId,
      internalUserId: session.userId,
      resourceId: session.resourceId,
      resourceKey: session.resource.resourceKey,
      managedAccountKey: session.managedAccount.accountKey,
      upstreamCookies: session.upstreamCookies as any,
      status: session.status as BrokerSessionStatus,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      appHost: session.resource.appHost,
      apiHost: session.resource.apiHost,
    };
  }

  async update(brokerSessionId: string, patch: Partial<BrokerSession>): Promise<void> {
    await prisma.brokerSession.update({
      where: { brokerSessionId },
      data: {
        status: patch.status,
        expiresAt: patch.expiresAt ? new Date(patch.expiresAt) : undefined,
        upstreamCookies: patch.upstreamCookies as any,
      },
    });
  }

  async end(brokerSessionId: string): Promise<void> {
    await this.update(brokerSessionId, { status: "ended" });
  }

  async listByUser(internalUserId: string): Promise<BrokerSession[]> {
    const sessions = await prisma.brokerSession.findMany({
      where: { userId: internalUserId },
      include: { resource: true, managedAccount: true },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((s) => ({
      brokerSessionId: s.brokerSessionId,
      internalUserId: s.userId,
      resourceId: s.resourceId,
      resourceKey: s.resource.resourceKey,
      managedAccountKey: s.managedAccount.accountKey,
      upstreamCookies: s.upstreamCookies as any,
      status: s.status as BrokerSessionStatus,
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      appHost: s.resource.appHost,
      apiHost: s.resource.apiHost,
    }));
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _repo: ISessionRepository | null = null;

export async function getSessionRepository(): Promise<ISessionRepository> {
  if (_repo) return _repo;
  _repo = new PostgresSessionRepository();
  return _repo;
}
