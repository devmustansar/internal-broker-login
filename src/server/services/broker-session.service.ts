import type { BrokerSession, OpenAppRequest, OpenAppResponse, InternalUser, Resource, ManagedAccount } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { secretManager } from "@/server/secrets/secret-manager";
import { getLoginAdapter } from "@/server/adapters/login.adapter";
import { getSessionRepository } from "@/server/repositories/session.repository";
import { appAccessService } from "./app-access.service";
import { auditLogService } from "./audit.service";
import { SESSION_TTL_SECONDS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

// ─── Broker Session Service ───────────────────────────────────────────────────
//
// Updated flow (one-time-token redirect):
//   1. Validate user + ACL
//   2. Resolve resource & managed account
//   3. Fetch credentials from Vault
//   4. POST credentials to client backend (loginUrl) → client returns a one-time token
//   5. Build redirect URL: appHost + tokenValidationPath + ?token=<one-time-token>
//   6. Store a lightweight broker session record (audit trail)
//   7. Return { redirectUrl } to the frontend → frontend opens the URL directly
//
// The browser is redirected to the client app, which validates the token server-side
// and logs the user in. No cookies are captured or proxied by the broker.

export const brokerSessionService = {
  async openApp(
    internalUserId: string,
    req: OpenAppRequest
  ): Promise<OpenAppResponse> {
    const { resourceKey } = req;
    const repo = await getSessionRepository();

    // 1. Resolve the calling user
    const user = await appAccessService.getUserById(internalUserId);
    if (!user) {
      auditLogService.log({
        action: "app_open_attempt",
        internalUserId,
        resourceKey,
        outcome: "failure",
        details: { reason: "user_not_found" },
      });
      throw new Error("User not found");
    }

    // 2. Access control check
    const allowed = appAccessService.canUserAccessResource(user, resourceKey);
    auditLogService.log({
      action: allowed ? "access_granted" : "access_denied",
      internalUserId,
      resourceKey,
      outcome: allowed ? "success" : "failure",
    });

    if (!allowed) {
      throw new Error(`User '${user.email}' does not have access to '${resourceKey}'`);
    }

    // 3. Resolve resource
    const resource = await appAccessService.getResourceByKey(resourceKey);
    if (!resource) {
      throw new Error(`Resource '${resourceKey}' not found or inactive`);
    }

    // 4. Resolve managed account
    const managedAccount = await appAccessService.getManagedAccountForResource(resource.id);
    if (!managedAccount) {
      throw new Error(`No active managed account for resource '${resourceKey}'`);
    }

    // 5. Fetch credentials (decrypted) from secrets provider
    // The secretManager reads from DB (encrypted) or Vault based on SECRET_PROVIDER env.
    // `managedAccount.vaultPath` is repurposed as the secretRef key.
    const secret = await secretManager.getSecret(
      managedAccount.vaultPath,
      "web_basic_credentials"
    );
    const credential = {
      email: secret.payload.username,
      password: secret.payload.password,
      loginType: "password",
      extra: secret.payload.extra,
    };
    auditLogService.log({
      action: "vault_credential_fetched",
      internalUserId,
      resourceKey,
      outcome: "success",
      details: { vaultPath: managedAccount.vaultPath },
    });

    // 6. POST credentials to client backend → receive one-time token
    //    The loginAdapter calls resource.loginUrl (client backend) with the Vault credentials.
    //    The client backend validates the credentials and returns a one-time token.
    //    The broker extracts the token via tokenExtractionPath (e.g. "data.token") or
    //    common fallback paths (token / access_token / info.token …).
    console.log(`[BrokerSession] Requesting one-time token from '${resource.loginUrl}'`);
    const adapter = getLoginAdapter(resource.loginAdapter);
    const loginResult = await adapter.login(resource.loginUrl, credential, {
      tokenExtractionPath: resource.tokenExtractionPath,
      usernameField: resource.usernameField,
      passwordField: resource.passwordField,
    });

    if (!loginResult.success) {
      auditLogService.log({
        action: "one_time_token_failed",
        internalUserId,
        resourceKey,
        outcome: "failure",
        details: {
          adapter: resource.loginAdapter,
          statusCode: loginResult.statusCode,
          errorMessage: loginResult.errorMessage,
        },
      });
      console.error(`[BrokerSession] Client backend returned failure for '${resourceKey}':`, loginResult);
      throw new Error(
        `Client backend rejected credentials for '${resourceKey}': ${loginResult.errorMessage}`
      );
    }

    // Extract the one-time token from the login result
    // The adapter stores it under the "token" key in upstreamCookies for json_login,
    // or it may be in metadata.oneTimeToken for future adapters.
    const oneTimeToken: string | undefined =
      (loginResult.upstreamCookies?.["token"]) ||
      (loginResult.metadata?.oneTimeToken as string | undefined);

    if (!oneTimeToken) {
      auditLogService.log({
        action: "one_time_token_failed",
        internalUserId,
        resourceKey,
        outcome: "failure",
        details: { reason: "token_not_found_in_response", adapter: resource.loginAdapter },
      });
      throw new Error(
        `Client backend did not return a one-time token for '${resourceKey}'. ` +
        `Check tokenExtractionPath config or adapter response.`
      );
    }

    auditLogService.log({
      action: "one_time_token_issued",
      internalUserId,
      resourceKey,
      outcome: "success",
      details: { adapter: resource.loginAdapter },
    });

    // 7. Build the redirect URL
    //    Format: <appHost><tokenValidationPath>?token=<oneTimeToken>
    //    e.g. https://app.client.com/auth/validate?token=abc123
    const validationPath = resource.tokenValidationPath ?? "/auth/validate";
    const redirectUrl = `${resource.appHost}${validationPath}?token=${encodeURIComponent(oneTimeToken)}`;

    auditLogService.log({
      action: "redirect_url_issued",
      internalUserId,
      resourceKey,
      outcome: "success",
      details: { appHost: resource.appHost, validationPath },
    });

    // 8. Create a lightweight broker session record for audit/tracking
    const brokerSessionId = uuidv4();
    const expiresAt = new Date(
      Date.now() + SESSION_TTL_SECONDS * 1000
    ).toISOString();

    const session: BrokerSession = {
      brokerSessionId,
      internalUserId,
      resourceKey,
      managedAccountKey: managedAccount.accountKey,
      // No upstream cookies captured in this flow — the client manages its own auth
      upstreamCookies: {},
      expiresAt,
      createdAt: new Date().toISOString(),
      status: "active",
      appHost: resource.appHost,
      apiHost: resource.apiHost,
      metadata: {
        flow: "one_time_token_redirect",
        loginAdapter: resource.loginAdapter,
        validationPath,
      },
    };

    await repo.create(session);

    auditLogService.log({
      action: "broker_session_created",
      internalUserId,
      resourceKey,
      brokerSessionId,
      outcome: "success",
      details: { expiresAt, flow: "one_time_token_redirect" },
    });

    return {
      brokerSessionId,
      resourceKey,
      appHost: resource.appHost,
      apiHost: resource.apiHost,
      expiresAt,
      status: "active",
      redirectUrl,
    };
  },

  async getSession(brokerSessionId: string): Promise<BrokerSession | null> {
    const repo = await getSessionRepository();
    return repo.get(brokerSessionId);
  },

  async endSession(brokerSessionId: string, internalUserId: string): Promise<void> {
    const repo = await getSessionRepository();
    await repo.end(brokerSessionId);

    auditLogService.log({
      action: "broker_session_ended",
      internalUserId,
      brokerSessionId,
      outcome: "success",
    });
  },

  async listUserSessions(internalUserId: string): Promise<BrokerSession[]> {
    const repo = await getSessionRepository();
    return repo.listByUser(internalUserId);
  },

  // ─── Admin Actions ──────────────────────────────────────────────────────────

  async createResource(data: any): Promise<Resource> {
    return (await prisma.resource.create({ data })) as any;
  },

  async createUser(data: any): Promise<InternalUser> {
    return (await prisma.user.create({ data })) as any;
  },

  async addManagedAccount(data: any): Promise<ManagedAccount> {
    return (await prisma.managedAccount.create({ data })) as any;
  },
};
