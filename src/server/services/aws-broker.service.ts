import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import type { AwsResourceConfig, AwsFederationResult, AwsAuditDetails } from "@/types";
import { auditLogService } from "./audit.service";
import { awsFederationService, AwsStsError, AwsFederationError, AwsValidationError } from "./aws-federation.service";
import { secretManager, SecretNotFoundError } from "@/server/secrets/secret-manager";
import { appAccessService } from "./app-access.service";

// ─── AWS Broker Service ───────────────────────────────────────────────────────
//
// Orchestrates the full AWS Console federation flow:
//   1. Validate portal session + entitlement
//   2. Load AwsResource config from DB
//   3. Load broker IAM credentials from SecretsProvider (DummyVault / real Vault)
//   4. Call awsFederationService to obtain temporary STS credentials + SigninToken
//   5. Return the console login URL to the route handler

export interface AwsLaunchRequest {
  /** resourceKey from the AwsResource table, e.g. "aws-prod-readonly" */
  resourceKey: string;
  /** IP address from the portal request, for audit logging */
  ipAddress?: string;
  /** User-Agent from the portal request, for audit logging */
  userAgent?: string;
}

export interface AwsLaunchResponse {
  /** UUID for this launch event — useful for support lookups */
  launchId: string;
  /** The AWS Console federation login URL including SigninToken */
  loginUrl: string;
  /** ISO timestamp when the STS credentials (and therefore this URL) expire */
  expiresAt: string;
  /** AWS account ID, for display in the portal */
  awsAccountId: string;
  /** IAM role that was assumed */
  roleArn: string;
}

export const awsBrokerService = {
  /**
   * Executes the full AWS federation launch flow for a portal user.
   *
   * @param internalUserId - Portal user ID (from JWT)
   * @param request        - Launch request with resourceKey and request metadata
   */
  async launchAwsConsole(
    internalUserId: string,
    request: AwsLaunchRequest
  ): Promise<AwsLaunchResponse> {
    const launchId = uuidv4();
    const { resourceKey, ipAddress, userAgent } = request;

    // ── Step 1: Verify the portal user exists ─────────────────────────────────
    const user = await appAccessService.getUserById(internalUserId);
    if (!user) {
      auditLogService.log({
        action: "aws_launch_attempt",
        internalUserId,
        resourceKey,
        outcome: "failure",
        details: { launchId, reason: "user_not_found" },
        ipAddress,
      });
      throw new Error("User not found");
    }

    // ── Step 2: Entitlement check ─────────────────────────────────────────────
    // Reuses the same ACL logic as web app resources:
    // user.allowedResourceKeys must include '*' or the exact resourceKey.
    const isEntitled = appAccessService.canUserAccessResource(user, resourceKey);

    auditLogService.log({
      action: isEntitled ? "access_granted" : "aws_entitlement_denied",
      internalUserId,
      resourceKey,
      outcome: isEntitled ? "success" : "failure",
      details: { launchId, flow: "aws_federation" },
      ipAddress,
    });

    if (!isEntitled) {
      throw new Error(
        `User '${user.email}' does not have entitlement for AWS resource '${resourceKey}'`
      );
    }

    // ── Step 3: Load AwsResource config from DB ───────────────────────────────
    const awsResource = await prisma.awsResource.findUnique({
      where: { resourceKey, isActive: true },
    });

    if (!awsResource) {
      auditLogService.log({
        action: "aws_launch_attempt",
        internalUserId,
        resourceKey,
        outcome: "failure",
        details: { launchId, reason: "resource_not_found_or_inactive" },
        ipAddress,
      });
      throw new Error(`AWS resource '${resourceKey}' not found or is inactive`);
    }

    // Build strongly-typed config from DB record
    const config: AwsResourceConfig = {
      awsAccountId: awsResource.awsAccountId,
      roleArn: awsResource.roleArn,
      region: awsResource.region,
      destination: awsResource.destination,
      issuer: awsResource.issuer,
      sessionDurationSeconds: awsResource.sessionDurationSeconds,
      externalId: awsResource.externalId ?? undefined,
      brokerCredentialRef: awsResource.brokerCredentialRef,
      stsStrategy: awsResource.stsStrategy as AwsResourceConfig["stsStrategy"],
    };

    // ── Step 4: Load broker IAM credentials from SecretsProvider ─────────────
    // TODO: When integrating real Vault, secretsProvider will transparently
    //       switch to HashiCorpVaultSecretsProvider — no changes needed here.
    let brokerCreds;
    try {
      const secret = await secretManager.getSecret(
        config.brokerCredentialRef,
        "aws_iam_credentials"
      );
      brokerCreds = secret.payload;
      auditLogService.log({
        action: "aws_secrets_loaded",
        internalUserId,
        resourceKey,
        outcome: "success",
        details: {
          launchId,
          credentialRef: config.brokerCredentialRef,
          // SECURITY: Never log accessKeyId or secretAccessKey
        },
        ipAddress,
      });
    } catch (err) {
      auditLogService.log({
        action: "aws_secrets_failed",
        internalUserId,
        resourceKey,
        outcome: "failure",
        details: {
          launchId,
          credentialRef: config.brokerCredentialRef,
          error: err instanceof Error ? err.message : "unknown",
        },
        ipAddress,
      });
      throw new Error(
        `Failed to load broker credentials for ref '${config.brokerCredentialRef}': ${err instanceof Error ? err.message : "unknown error"
        }`
      );
    }

    // ── Step 5: Generate AWS Console login URL ────────────────────────────────
    // The STS session name includes the userId for CloudTrail attribution.
    const sessionName = `${sanitizeForSessionName(user.email)}`;

    let federationResult: AwsFederationResult;
    try {
      auditLogService.log({
        action: "aws_launch_attempt",
        internalUserId,
        resourceKey,
        outcome: "info",
        details: {
          launchId,
          awsAccountId: config.awsAccountId,
          roleArn: config.roleArn,
          region: config.region,
          stsStrategy: config.stsStrategy,
          sessionDuration: config.sessionDurationSeconds,
          destination: config.destination,
          ipAddress,
          userAgent,
          brokerCredentialRef: config.brokerCredentialRef,
        },
        ipAddress,
      });

      federationResult = await awsFederationService.generateConsoleLoginUrl(
        config,
        brokerCreds,
        sessionName
      );
    } catch (err) {
      // Categorise the error for targeted audit log entries
      const isValidationError = err instanceof AwsValidationError;
      const isStsError = err instanceof AwsStsError;
      const isFederationError = err instanceof AwsFederationError;

      auditLogService.log({
        action: isStsError ? "aws_sts_failed" : "aws_signin_token_failed",
        internalUserId,
        resourceKey,
        outcome: "failure",
        details: {
          launchId,
          awsAccountId: config.awsAccountId,
          roleArn: config.roleArn,
          errorType: err instanceof Error ? err.name : "unknown",
          // Truncate error message — never include full AWS SDK error with request IDs
          error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
          isValidationError,
          isStsError,
          isFederationError,
        },
        ipAddress,
      });

      // Re-throw with a sanitised message (no raw AWS internals)
      if (isValidationError) {
        throw new Error(`AWS resource config invalid: ${err.message}`);
      }
      if (isStsError) {
        throw new Error(
          `Failed to obtain temporary AWS credentials. ` +
          `Check that role '${config.roleArn}' exists and the broker has sts:AssumeRole permission.`
        );
      }
      throw new Error(
        "Failed to generate AWS Console sign-in URL. Contact your administrator."
      );
    }

    // ── Step 6: Audit success and return ─────────────────────────────────────
    auditLogService.log({
      action: "aws_console_redirect_issued",
      internalUserId,
      resourceKey,
      outcome: "success",
      details: {
        launchId,
        awsAccountId: federationResult.awsAccountId,
        roleArn: federationResult.roleArn,
        expiresAt: federationResult.expiresAt,
        sessionName,
        // SECURITY: loginUrl contains the SigninToken — never log it
        destination: config.destination,
        stsStrategy: config.stsStrategy,
        ipAddress,
        userAgent,
      },
      ipAddress,
    });

    return {
      launchId,
      loginUrl: federationResult.loginUrl,
      expiresAt: federationResult.expiresAt,
      awsAccountId: federationResult.awsAccountId,
      roleArn: federationResult.roleArn,
    };
  },

  // ── Admin helpers ───────────────────────────────────────────────────────────

  async createAwsResource(data: {
    resourceKey: string;
    name: string;
    description?: string;
    awsAccountId: string;
    roleArn: string;
    region?: string;
    destination?: string;
    issuer?: string;
    sessionDurationSeconds?: number;
    externalId?: string;
    brokerCredentialRef: string;
    stsStrategy?: string;
    environment?: string;
  }) {
    return prisma.awsResource.create({ data });
  },

  async listAwsResources() {
    return prisma.awsResource.findMany({ where: { isActive: true } });
  },

  async getAwsResourceByKey(resourceKey: string) {
    return prisma.awsResource.findUnique({ where: { resourceKey, isActive: true } });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeForSessionName(email: string): string {
  return email.replace(/[^a-zA-Z0-9_=,.@-]/g, "-").slice(0, 32);
}
