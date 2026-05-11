import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptPayload } from "@/server/secrets/encryption";

/**
 * GET /api/credentials
 * Returns all credentials shared with the current user, either:
 *   - via direct CredentialShare, or
 *   - via CredentialGroupMember → group → group entries
 *
 * Decrypts payloads on the fly. Only the authenticated user's own creds.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    // 1. Direct shares
    const directShares = await prisma.credentialShare.findMany({
      where: { userId: auth.userId },
      include: {
        credential: {
          include: {
            organization: { select: { id: true, name: true } },
            groups: {
              include: { group: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    // 2. Group-based shares
    const groupMemberships = await prisma.credentialGroupMember.findMany({
      where: { userId: auth.userId },
      include: {
        group: {
          include: {
            credentials: {
              include: {
                credential: {
                  include: {
                    organization: { select: { id: true, name: true } },
                    groups: {
                      include: { group: { select: { id: true, name: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Build unique set of credentials (avoid duplicates if shared via multiple paths)
    const credentialMap = new Map<string, any>();

    for (const share of directShares) {
      const cred = share.credential;
      if (!credentialMap.has(cred.id)) {
        const decrypted = decryptPayload<{ username: string; password: string }>(
          cred.encryptedPayload,
          `credential:${cred.id}`
        );
        credentialMap.set(cred.id, {
          id: cred.id,
          appName: cred.appName,
          loginUrl: cred.loginUrl,
          description: cred.description,
          username: decrypted.username,
          password: decrypted.password,
          organization: cred.organization,
          groups: cred.groups.map((g: any) => g.group),
          sharedVia: "direct",
        });
      }
    }

    for (const membership of groupMemberships) {
      for (const entry of membership.group.credentials) {
        const cred = entry.credential;
        if (!credentialMap.has(cred.id)) {
          const decrypted = decryptPayload<{ username: string; password: string }>(
            cred.encryptedPayload,
            `credential:${cred.id}`
          );
          credentialMap.set(cred.id, {
            id: cred.id,
            appName: cred.appName,
            loginUrl: cred.loginUrl,
            description: cred.description,
            username: decrypted.username,
            password: decrypted.password,
            organization: cred.organization,
            groups: cred.groups.map((g: any) => g.group),
            sharedVia: `group:${membership.group.name}`,
          });
        }
      }
    }

    return NextResponse.json(Array.from(credentialMap.values()));
  } catch (err) {
    return serverError(err);
  }
}
