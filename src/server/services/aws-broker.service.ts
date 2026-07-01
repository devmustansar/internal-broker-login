import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import type { AwsResourceConfig, AwsFederationResult } from "@/types";
import { auditLogService } from "./audit.service";
import { awsFederationService, AwsStsError, AwsFederationError, AwsValidationError } from "./aws-federation.service";
import { awsSsoOidcService } from "./aws-sso-oidc.service";
import { secretManager } from "@/server/secrets/secret-manager";
import type { AwsSsoOidcCredentials } from "@/server/secrets/types";
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
  /** The AWS Console federation login URL including SigninToken, or an SSO portal URL */
  loginUrl: string;
  /** ISO timestamp when the STS credentials expire — empty string for aws_sso redirects */
  expiresAt: string;
  /** AWS account ID, for display in the portal */
  awsAccountId: string;
  /** IAM role that was assumed — undefined for aws_sso strategy */
  roleArn?: string;
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
    // Check user's resource access via the UserResourceAccess join table.
    // Super admins bypass via role check.
    const isEntitled = user.role === "super_admin" || await appAccessService.canUserAccessResource(internalUserId, resourceKey);

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
      sessionName: awsResource.sessionName ?? undefined,
      ssoStartUrl: awsResource.ssoStartUrl ?? undefined,
      ssoPermissionSetName: awsResource.ssoPermissionSetName ?? undefined,
      ssoRegion: awsResource.ssoRegion ?? undefined,
    };

    // ── Step 3b: Look up user-specific session policies ──────────────────────
    const userPolicy = await prisma.userAwsPolicy.findUnique({
      where: {
        userId_awsResourceId: {
          userId: internalUserId,
          awsResourceId: awsResource.id,
        },
      },
    });

    // If the resource has policies configured, require at least one to be
    // assigned to the user. Without this gate, missing policy assignments
    // result in wildcard access (full role permissions / allow-all inline policy).
    // Super admins bypass this check — they always have full access.
    const resourceHasPolicies = awsResource.availablePolicyArns.length > 0;
    const userHasPolicies = userPolicy && userPolicy.policyArns.length > 0;

    if (user.role !== "super_admin" && resourceHasPolicies && !userHasPolicies) {
      auditLogService.log({
        action: "aws_launch_denied_no_policies",
        internalUserId,
        resourceKey,
        outcome: "failure",
        details: { launchId, reason: "no_policies_assigned" },
        ipAddress,
      });
      throw new Error(
        `NO_POLICIES_ASSIGNED: No policies are assigned to your account for this resource. Contact your administrator.`
      );
    }

    if (userPolicy && userPolicy.policyArns.length > 0) {
      config.policyArns = userPolicy.policyArns;
      console.log(
        `[aws-broker] Applying ${userPolicy.policyArns.length} session policies for user ${user.email} on ${resourceKey}`
      );
    }

    // Apply per-user session name override if configured
    if (userPolicy?.sessionName) {
      config.sessionName = userPolicy.sessionName;
      console.log(
        `[aws-broker] Using per-user session name "${userPolicy.sessionName}" for ${user.email} on ${resourceKey}`
      );
    }

    // ── Step 3c: AWS SSO OIDC flow ───────────────────────────────────────────
    // For aws_sso resources the broker uses a stored refresh token to get
    // fresh temporary credentials on every tile click — no user input ever.
    if (config.stsStrategy === "aws_sso") {
      if (!config.ssoPermissionSetName) {
        throw new Error(
          `AWS SSO resource '${resourceKey}' has no permission set name configured.`
        );
      }

      // Load the stored OIDC credentials (clientId, clientSecret, refreshToken, ssoRegion)
      let oidcCreds: AwsSsoOidcCredentials;
      try {
        const secret = await secretManager.getSecret(
          `aws/resource/${resourceKey}/sso-oidc`,
          "aws_sso_oidc"
        );
        oidcCreds = secret.payload;
      } catch {
        throw new Error(
          `AWS SSO resource '${resourceKey}' is not connected yet. ` +
          `Complete the SSO setup in Admin → AWS Resources.`
        );
      }

      // Use refresh token to get a fresh access token, or fall back to stored
      // access token when no refresh token was issued at setup time.
      let tokens: { accessToken: string; refreshToken: string };
      if (oidcCreds.refreshToken) {
        try {
          tokens = await awsSsoOidcService.refreshAccessToken(
            oidcCreds.ssoRegion,
            oidcCreds.clientId,
            oidcCreds.clientSecret,
            oidcCreds.refreshToken
          );
        } catch (err: any) {
          const errorId: string = err?.name ?? err?.code ?? "";
          const oauthError: string = err?.error ?? "";
          const isExpired =
            errorId.includes("Expired") ||
            errorId.includes("InvalidGrant") ||
            oauthError === "invalid_grant" ||
            oauthError === "expired_token";
          throw new Error(
            isExpired
              ? `AWS SSO session expired for resource '${resourceKey}'. Re-run SSO setup in Admin → AWS Resources.`
              : `AWS SSO token refresh failed for resource '${resourceKey}': ${err?.message ?? "unknown error"}`
          );
        }

        // If AWS rotated the refresh token, persist the new one
        if (tokens.refreshToken && tokens.refreshToken !== oidcCreds.refreshToken) {
          await secretManager.updateSecret(`aws/resource/${resourceKey}/sso-oidc`, {
            payload: { ...oidcCreds, refreshToken: tokens.refreshToken },
          }).catch(() => {});
        }
      } else {
        // No refresh token was issued — use the stored access token directly.
        // Valid for ~8 hours; if it has expired the GetRoleCredentials call below will
        // throw and the error handler will tell the user to re-connect.
        if (!oidcCreds.accessToken) {
          throw new Error(
            `AWS SSO resource '${resourceKey}' has no refresh token and no stored access token. ` +
            `Re-run SSO setup in Admin → AWS Resources.`
          );
        }
        tokens = { accessToken: oidcCreds.accessToken, refreshToken: "" };
      }

      // Exchange access token for temporary AWS credentials for this account + permission set
      const roleCreds = await awsSsoOidcService.getRoleCredentials(
        oidcCreds.ssoRegion,
        tokens.accessToken,
        config.awsAccountId,
        config.ssoPermissionSetName
      );

      // Use the credentials directly with the federation endpoint — no STS call
      const federationResult = await awsFederationService.generateConsoleLoginUrlFromCredentials(
        roleCreds,
        config
      );

      auditLogService.log({
        action: "aws_console_redirect_issued",
        internalUserId,
        resourceKey,
        outcome: "success",
        details: {
          launchId,
          awsAccountId: config.awsAccountId,
          stsStrategy: "aws_sso",
          ssoPermissionSetName: config.ssoPermissionSetName,
          expiresAt: federationResult.expiresAt,
          ipAddress,
          userAgent,
        },
        ipAddress,
      });

      return {
        launchId,
        loginUrl: federationResult.loginUrl,
        expiresAt: federationResult.expiresAt,
        awsAccountId: config.awsAccountId,
      };
    }

    // ── Step 4: Load broker IAM credentials from SecretsProvider ─────────────
    // Credentials are stored per-resource under aws/resource/{resourceKey}.
    // Fall back to config.brokerCredentialRef for legacy records.
    const derivedSecretRef = `aws/resource/${resourceKey}`;
    const legacyRef = config.brokerCredentialRef;
    const secretRef =
      (await secretManager.hasSecret(derivedSecretRef))
        ? derivedSecretRef
        : (legacyRef && (await secretManager.hasSecret(legacyRef)) ? legacyRef : derivedSecretRef);

    let brokerCreds;
    try {
      const secret = await secretManager.getSecret(secretRef, "aws_iam_credentials");
      brokerCreds = secret.payload;
      auditLogService.log({
        action: "aws_secrets_loaded",
        internalUserId,
        resourceKey,
        outcome: "success",
        details: {
          launchId,
          credentialRef: secretRef,
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
          credentialRef: secretRef,
          error: err instanceof Error ? err.message : "unknown",
        },
        ipAddress,
      });
      throw new Error(
        `Failed to load broker credentials for resource '${resourceKey}': ${err instanceof Error ? err.message : "unknown error"}`
      );
    }

    // ── Step 5: Generate AWS Console login URL ────────────────────────────────
    // If the resource has a custom sessionName configured, use it.
    // Otherwise fall back to the authenticated user's email (sanitized for STS).
    // The session name appears in CloudTrail as the RoleSessionName.
    const sessionName = config.sessionName
      ? sanitizeForSessionName(config.sessionName)
      : sanitizeForSessionName(user.email);

    console.log(`[aws-broker] STS session name: "${sessionName}" (source: ${config.sessionName ? 'resource config' : 'user email'})`);

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
        if (config.stsStrategy === "federation_token") {
          throw new Error(
            `GetFederationToken failed for resource '${resourceKey}'. ` +
            `Check that the broker IAM user has sts:GetFederationToken permission ` +
            `and is using long-term credentials (not an assumed role).`
          );
        }
        const isUserArn = config.roleArn?.includes(":user/");
        throw new Error(
          isUserArn
            ? `Invalid role ARN '${config.roleArn}': this is an IAM user ARN — ` +
              `AssumeRole only works with role ARNs (arn:aws:iam::ACCOUNT:role/NAME). ` +
              `Edit the resource in Admin → AWS Resources and fix the ARN, ` +
              `or switch STS Strategy to "Federation Token (Identity)".`
            : `Failed to obtain temporary AWS credentials. ` +
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
    ssoStartUrl?: string | null;
    ssoPermissionSetName?: string | null;
    ssoRegion?: string | null;
    environment?: string;
    organizationId?: string | null;
    availablePolicyArns?: string[];
    sessionName?: string | null;
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
