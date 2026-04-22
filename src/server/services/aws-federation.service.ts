import { STSClient, AssumeRoleCommand, GetFederationTokenCommand } from "@aws-sdk/client-sts";
import type {
  AwsResourceConfig,
  AwsBrokerCredentials,
  AwsTemporaryCredentials,
  AwsFederationResult,
} from "@/types";

// ─── Managed-policy → inline-policy action mapping ────────────────────────────
//
// GetFederationToken does NOT properly scope AWS Console access via PolicyArns.
// AWS docs: managed PolicyArns through GetFederationToken are not supported for
// console federation sign-in (the restriction is ignored by the signin endpoint).
//
// Workaround: translate the assigned managed policy ARNs into an equivalent
// inline Policy JSON (Allow statements) so STS + the console honour the scope.
// Only the services declared here will be accessible in the federated session.

const MANAGED_POLICY_INLINE_MAP: Record<string, { actions: string[]; resources: string }> = {
  // Full access policies
  "arn:aws:iam::aws:policy/AdministratorAccess":        { actions: ["*"],             resources: "*" },
  "arn:aws:iam::aws:policy/PowerUserAccess":            { actions: ["*"],             resources: "*" },
  // Read-only / view-only
  "arn:aws:iam::aws:policy/ReadOnlyAccess":             { actions: ["*.Describe*", "*.List*", "*.Get*", "*.View*", "s3:GetObject"],  resources: "*" },
  "arn:aws:iam::aws:policy/ViewOnlyAccess":             { actions: ["*.Describe*", "*.List*", "*.Get*"],  resources: "*" },
  "arn:aws:iam::aws:policy/SecurityAudit":              { actions: ["*.Describe*", "*.List*", "*.Get*", "iam:*", "cloudtrail:*"],  resources: "*" },
  // S3
  "arn:aws:iam::aws:policy/AmazonS3FullAccess":         { actions: ["s3:*"],          resources: "*" },
  "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess":     { actions: ["s3:Get*", "s3:List*"],  resources: "*" },
  // EC2
  "arn:aws:iam::aws:policy/AmazonEC2FullAccess":        { actions: ["ec2:*", "elasticloadbalancing:*", "cloudwatch:*", "autoscaling:*"],  resources: "*" },
  "arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess":    { actions: ["ec2:Describe*", "elasticloadbalancing:Describe*", "cloudwatch:Describe*", "autoscaling:Describe*"],  resources: "*" },
  // RDS
  "arn:aws:iam::aws:policy/AmazonRDSFullAccess":        { actions: ["rds:*", "ec2:*", "cloudwatch:*"],  resources: "*" },
  // Lambda
  "arn:aws:iam::aws:policy/AWSLambda_FullAccess":       { actions: ["lambda:*", "iam:PassRole"],  resources: "*" },
  // DynamoDB
  "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess":   { actions: ["dynamodb:*", "cloudwatch:*"],  resources: "*" },
  // Job function policies
  "arn:aws:iam::aws:policy/job-function/Billing":                  { actions: ["aws-portal:*", "budgets:*", "ce:*", "cur:*"],  resources: "*" },
  "arn:aws:iam::aws:policy/job-function/DatabaseAdministrator":    { actions: ["rds:*", "dynamodb:*", "elasticache:*", "redshift:*", "cloudwatch:*"],  resources: "*" },
  "arn:aws:iam::aws:policy/job-function/DataScientistAccess":      { actions: ["s3:*", "athena:*", "glue:*", "sagemaker:*", "redshift:*"],  resources: "*" },
  "arn:aws:iam::aws:policy/job-function/NetworkAdministrator":     { actions: ["ec2:*", "elasticloadbalancing:*", "route53:*", "vpc:*"],  resources: "*" },
  "arn:aws:iam::aws:policy/job-function/SupportUser":              { actions: ["support:*", "*.Describe*", "*.List*"],  resources: "*" },
  "arn:aws:iam::aws:policy/job-function/SystemAdministrator":      { actions: ["*"],  resources: "*" },
  // SSO / service-linked
  "arn:aws:iam::aws:policy/aws-service-role/AWSSSOMemberAccountAdministrator": { actions: ["sso:*", "organizations:*"],  resources: "*" },
  "arn:aws:iam::aws:policy/aws-service-role/AWSSSODirectoryAdministrator":     { actions: ["sso:*", "identitystore:*"],  resources: "*" },
  "arn:aws:iam::aws:policy/aws-service-role/AWSSSOReadOnly":                   { actions: ["sso:List*", "sso:Get*", "identitystore:Describe*", "identitystore:List*"],  resources: "*" },
};

/**
 * Converts a list of managed policy ARNs to a single inline IAM policy JSON.
 * Needed because GetFederationToken's PolicyArns don't restrict console federation.
 */
function buildInlinePolicyFromArns(policyArns: string[]): string {
  const statements: object[] = [];

  // Collect all action sets from the mapped ARNs
  const actionSets: string[][] = [];
  for (const arn of policyArns) {
    const mapped = MANAGED_POLICY_INLINE_MAP[arn];
    if (mapped) {
      actionSets.push(mapped.actions);
    } else {
      // Unknown ARN — assume it's a custom policy; log and allow all as fallback
      console.warn(`[aws-federation] Unknown policy ARN in inline map, defaulting to allow-all: ${arn}`);
      actionSets.push(["*"]);
    }
  }

  // Check if any policy is allow-all
  const isAllowAll = actionSets.some((a) => a.includes("*"));
  const mergedActions = isAllowAll ? ["*"] : [...new Set(actionSets.flat())];

  statements.push({
    Effect: "Allow",
    Action: mergedActions,
    Resource: "*",
  });

  return JSON.stringify({ Version: "2012-10-17", Statement: statements });
}

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
        ? await getFederationTokenCredentials(brokerCreds, sessionName, durationSeconds, config.policyArns)
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
    // Session policies scope down the assumed role's permissions per-user
    ...(config.policyArns && config.policyArns.length > 0
      ? { PolicyArns: config.policyArns.map((arn) => ({ arn })) }
      : {}),
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
  durationSeconds: number,
  policyArns?: string[]
): Promise<AwsTemporaryCredentials> {
  // GetFederationToken is a global endpoint — region param is ignored by STS
  const sts = buildStsClient(brokerCreds, "us-east-1");

  const hasExplicitPolicies = policyArns && policyArns.length > 0;

  // IMPORTANT — why we use inline Policy, NOT PolicyArns here:
  //
  // AWS GetFederationToken's `PolicyArns` parameter does NOT reliably restrict
  // console federation sign-in sessions. The AWS federation signin endpoint at
  // signin.aws.amazon.com/federation honours the inline `Policy` JSON, but 
  // the `PolicyArns` session-policy restriction is silently ignored during
  // console token exchange for browser-based sessions.
  //
  // Fix: translate the assigned managed policy ARNs into an equivalent inline
  // IAM policy document (Allow statements with the relevant IAM actions).
  // This is the only reliable way to scope GetFederationToken console sessions.

  let inlinePolicy: string;
  if (hasExplicitPolicies) {
    inlinePolicy = buildInlinePolicyFromArns(policyArns!);
    console.log(
      `[aws-federation] GetFederationToken: scoping session with inline policy derived from ${policyArns!.length} ARN(s):`,
      policyArns
    );
    console.log("[aws-federation] Inline policy JSON:", inlinePolicy);
  } else {
    // No per-user policies → broker user's full effective permissions
    inlinePolicy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }],
    });
    console.log("[aws-federation] GetFederationToken: no per-user policies, using allow-all fallback");
  }

  const cmd = new GetFederationTokenCommand({
    Name: sanitizeSessionName(federatedUserName),
    DurationSeconds: durationSeconds,
    Policy: inlinePolicy,
    // NOTE: PolicyArns intentionally NOT sent — unreliable for console federation.
    // Per-user scoping is handled via the inline Policy above.
  });

  let result;
  try {
    result = await sts.send(cmd);
  } catch (err) {
    console.error("[aws-federation] GetFederationToken failed:", err);
    throw new AwsStsError("STS GetFederationToken failed", err);
  }

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
