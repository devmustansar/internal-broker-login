import { STSClient, AssumeRoleCommand, GetFederationTokenCommand } from "@aws-sdk/client-sts";
import type {
  AwsResourceConfig,
  AwsBrokerCredentials,
  AwsTemporaryCredentials,
  AwsFederationResult,
} from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const AWS_FEDERATION_ENDPOINT = "https://signin.aws.amazon.com/federation";
const AWS_CONSOLE_BASE = "https://console.aws.amazon.com/";

/**
 * Allowlist of URL prefixes that are valid AWS Console destinations.
 * Any destination stored in the DB is validated against this list before
 * generating a redirect URL, preventing open-redirect attacks.
 *
 * Extend this list carefully — never allow arbitrary user-supplied URLs.
 */
const ALLOWED_DESTINATION_PREFIXES = [
  "https://console.aws.amazon.com/",
  "https://us-east-1.console.aws.amazon.com/",
  "https://us-east-2.console.aws.amazon.com/",
  "https://us-west-1.console.aws.amazon.com/",
  "https://us-west-2.console.aws.amazon.com/",
  "https://eu-west-1.console.aws.amazon.com/",
  "https://eu-central-1.console.aws.amazon.com/",
  "https://ap-southeast-1.console.aws.amazon.com/",
  "https://ap-northeast-1.console.aws.amazon.com/",
];

// Minimum/maximum STS session duration enforced by AWS
const STS_MIN_DURATION_SECONDS = 900;   // 15 minutes
const STS_MAX_DURATION_SECONDS = 43200; // 12 hours

// ─── AWS Federation Service ───────────────────────────────────────────────────

export const awsFederationService = {
  /**
   * Full federation flow: STS credentials → SigninToken → console login URL.
   *
   * @param config     - Resource configuration (roleArn, destination, etc.)
   * @param brokerCreds - Broker IAM credentials loaded from SecretsProvider
   * @param sessionName - Unique name for the STS session (include userId for CloudTrail)
   * @returns          - Login URL and metadata for the response
   */
  async generateConsoleLoginUrl(
    config: AwsResourceConfig,
    brokerCreds: AwsBrokerCredentials,
    sessionName: string
  ): Promise<AwsFederationResult> {
    // 1. Validate destination URL against allowlist
    validateDestination(config.destination);

    // 2. Validate session duration
    const durationSeconds = clampDuration(config.sessionDurationSeconds);

    // 3. Obtain temporary credentials from STS
    const tmpCreds =
      config.stsStrategy === "federation_token"
        ? await getFederationTokenCredentials(brokerCreds, sessionName, durationSeconds)
        : await assumeRoleCredentials(brokerCreds, config, sessionName, durationSeconds);

    // 4. Request SigninToken from AWS federation endpoint
    const signinToken = await getSigninToken(tmpCreds, durationSeconds);

    // 5. Build final console login URL
    const loginUrl = buildLoginUrl(signinToken, config);

    return {
      loginUrl,
      expiresAt: tmpCreds.expiration.toISOString(),
      awsAccountId: config.awsAccountId,
      roleArn: config.roleArn,
    };
  },
};

// ─── STS: AssumeRole (preferred) ─────────────────────────────────────────────
//
// Use when: the broker IAM user has sts:AssumeRole permission and the target
// role's trust policy lists the broker IAM user as a principal.
// This is the recommended approach because it produces scoped, short-lived
// credentials that are tied to a specific role and auditable in CloudTrail.

async function assumeRoleCredentials(
  brokerCreds: AwsBrokerCredentials,
  config: AwsResourceConfig,
  sessionName: string,
  durationSeconds: number
): Promise<AwsTemporaryCredentials> {
  const sts = buildStsClient(brokerCreds, config.region);

  const cmd = new AssumeRoleCommand({
    RoleArn: config.roleArn,
    RoleSessionName: sanitizeSessionName(sessionName),
    DurationSeconds: durationSeconds,
    // ExternalId is required when the target role's trust policy uses a Condition: StringEquals sts:ExternalId
    ...(config.externalId ? { ExternalId: config.externalId } : {}),
  });

  let result;
  try {
    result = await sts.send(cmd);
  } catch (err) {
    // Do NOT log the error message directly — it may contain ARN details
    throw new AwsStsError(
      `STS AssumeRole failed for role '${config.roleArn}' in account '${config.awsAccountId}'`,
      err
    );
  }

  const creds = result.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
    throw new AwsStsError("STS AssumeRole returned incomplete credentials");
  }

  return {
    sessionId: creds.AccessKeyId,
    sessionKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration ?? new Date(Date.now() + durationSeconds * 1000),
  };
}

// ─── STS: GetFederationToken (fallback) ───────────────────────────────────────
//
// Use when: AssumeRole is not available (e.g. broker uses root credentials — avoid
// this in production). The broker credentials ARE the credentials used to call
// the federation endpoint directly.
// NOTE: GetFederationToken does not support MFA and cannot be assumed cross-account.
// Prefer AssumeRole wherever possible.

async function getFederationTokenCredentials(
  brokerCreds: AwsBrokerCredentials,
  federatedUserName: string,
  durationSeconds: number
): Promise<AwsTemporaryCredentials> {
  const sts = buildStsClient(brokerCreds, "us-east-1"); // GetFederationToken is global
  console.log("11111111111111111111")

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "*",
        Resource: "*"
      }
    ]
  };

  const cmd = new GetFederationTokenCommand({
    Name: sanitizeSessionName(federatedUserName),
    DurationSeconds: durationSeconds,
    Policy: JSON.stringify(policy),
    // No Policy = inherits broker's permissions. In production, scope this down
    // with an inline policy that grants only the console read permissions needed.
  });
  console.log("22222222222222222222")

  let result;
  try {
    result = await sts.send(cmd);
  } catch (err) {
    console.log("44444444444444444444", err)
    throw new AwsStsError("STS GetFederationToken failed", err);
  }

  console.log("33333333333333333333")
  const creds = result.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
    throw new AwsStsError("STS GetFederationToken returned incomplete credentials");
  }

  return {
    sessionId: creds.AccessKeyId,
    sessionKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration ?? new Date(Date.now() + durationSeconds * 1000),
  };
}

// ─── AWS SigninToken ──────────────────────────────────────────────────────────

/**
 * Exchanges temporary STS credentials for an AWS SigninToken via the
 * AWS federation endpoint. The SigninToken is a short-lived opaque token
 * that can be embedded in a console login URL.
 *
 * Reference: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html
 */
async function getSigninToken(
  tmpCreds: AwsTemporaryCredentials,
  sessionDurationSeconds: number
): Promise<string> {
  // The session payload must NOT include any additional fields
  const sessionPayload = JSON.stringify({
    sessionId: tmpCreds.sessionId,
    sessionKey: tmpCreds.sessionKey,
    sessionToken: tmpCreds.sessionToken,
  });

  const params = new URLSearchParams({
    Action: "getSigninToken",
    SessionDuration: String(sessionDurationSeconds),
    Session: sessionPayload,
  });

  const url = `${AWS_FEDERATION_ENDPOINT}?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new AwsFederationError("Network error contacting AWS federation endpoint", err);
  }

  if (!res.ok) {
    throw new AwsFederationError(
      `AWS federation endpoint returned HTTP ${res.status}. ` +
      `Check that STS credentials are valid and not expired.`
    );
  }

  let body: { SigninToken?: string };
  try {
    body = await res.json();
  } catch {
    throw new AwsFederationError("AWS federation endpoint returned non-JSON response");
  }

  if (!body.SigninToken) {
    throw new AwsFederationError("AWS federation endpoint did not return a SigninToken");
  }

  return body.SigninToken;
}

// ─── Build final login URL ────────────────────────────────────────────────────

function buildLoginUrl(signinToken: string, config: AwsResourceConfig): string {
  const destination = config.destination || AWS_CONSOLE_BASE;
  validateDestination(destination); // re-validate here as an extra safety check

  const params = new URLSearchParams({
    Action: "login",
    Issuer: config.issuer || "internal-broker",
    Destination: destination,
    SigninToken: signinToken,
  });

  return `${AWS_FEDERATION_ENDPOINT}?${params.toString()}`;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateDestination(destination: string): void {
  if (!destination || typeof destination !== "string") {
    throw new AwsValidationError("destination is required and must be a string");
  }

  const isAllowed = ALLOWED_DESTINATION_PREFIXES.some((prefix) =>
    destination.startsWith(prefix)
  );

  if (!isAllowed) {
    // Do not echo the destination back to avoid leaking internal config
    throw new AwsValidationError(
      "destination URL is not in the allowlist. " +
      "Only AWS Console URLs are permitted."
    );
  }
}

function clampDuration(requestedSeconds: number): number {
  if (typeof requestedSeconds !== "number" || isNaN(requestedSeconds)) {
    return 3600; // safe default
  }
  return Math.min(STS_MAX_DURATION_SECONDS, Math.max(STS_MIN_DURATION_SECONDS, requestedSeconds));
}

/**
 * STS RoleSessionName must match [w+=,.@-]+ and be ≤ 64 chars.
 * We sanitize aggressively to avoid injection and truncate safely.
 */
function sanitizeSessionName(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9+=,.@_-]/g, "-")
    .slice(0, 64);
}

// ─── STS Client factory ───────────────────────────────────────────────────────

function buildStsClient(brokerCreds: AwsBrokerCredentials, region: string): STSClient {
  return new STSClient({
    region,
    credentials: {
      accessKeyId: brokerCreds.accessKeyId,
      secretAccessKey: brokerCreds.secretAccessKey,
      ...(brokerCreds.sessionToken ? { sessionToken: brokerCreds.sessionToken } : {}),
    },
  });
}

// ─── Domain-specific error classes ───────────────────────────────────────────

export class AwsStsError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AwsStsError";
    if (cause instanceof Error) {
      // Attach cause without leaking raw AWS API error messages to callers
      this.stack = `${this.stack}\nCaused by: ${cause.message}`;
    }
  }
}

export class AwsFederationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AwsFederationError";
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.message}`;
    }
  }
}

export class AwsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AwsValidationError";
  }
}
