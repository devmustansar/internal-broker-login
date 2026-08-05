import { prisma } from "@/lib/prisma";

/**
 * Append-only access log for personal vault actions. Never logs secret values.
 */
export async function logPersonalVaultAction(opts: {
  userId: string;
  action: string;
  targetType: "credential" | "2fa";
  targetId: string;
  outcome?: "success" | "failure";
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.personalVaultAccessLog.create({
    data: {
      userId: opts.userId,
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId,
      outcome: opts.outcome ?? "success",
      details: (opts.details ?? undefined) as any,
    },
  });
}
