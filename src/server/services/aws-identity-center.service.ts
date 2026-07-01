import {
  SSOAdminClient,
  ListInstancesCommand,
  ListPermissionSetsProvisionedToAccountCommand,
  DescribePermissionSetCommand,
  ListManagedPoliciesInPermissionSetCommand,
  ListCustomerManagedPolicyReferencesInPermissionSetCommand,
  GetInlinePolicyForPermissionSetCommand,
} from "@aws-sdk/client-sso-admin";

// ─── Auth-type detection ──────────────────────────────────────────────────────

export const AwsAuthType = {
  IAM_USER: "IAM_USER",
  AWS_SSO: "AWS_SSO",
  ASSUMED_ROLE: "ASSUMED_ROLE",
  UNKNOWN: "UNKNOWN",
} as const;
export type AwsAuthType = (typeof AwsAuthType)[keyof typeof AwsAuthType];

/**
 * Inspect a GetCallerIdentity ARN and classify the credential type.
 *
 * IAM user:       arn:aws:iam::123:user/alice
 * SSO session:    arn:aws:sts::123:assumed-role/AWSReservedSSO_<PermSet>_<hash>/session
 * Other role:     arn:aws:sts::123:assumed-role/SomeOtherRole/session
 */
export function detectAwsAuthType(callerArn: string): AwsAuthType {
  if (callerArn.includes(":user/")) return AwsAuthType.IAM_USER;
  if (callerArn.includes(":assumed-role/AWSReservedSSO_")) return AwsAuthType.AWS_SSO;
  if (callerArn.includes(":assumed-role/")) return AwsAuthType.ASSUMED_ROLE;
  return AwsAuthType.UNKNOWN;
}

/**
 * Extract the Permission Set name from an SSO-generated role name.
 *
 * "AWSReservedSSO_AdministratorAccess_abcd1234" → "AdministratorAccess"
 * Returns null if the name doesn't match the expected pattern.
 */
export function extractPermissionSetFromRoleName(roleName: string): string | null {
  const match = roleName.match(/^AWSReservedSSO_(.+)_[a-f0-9]{8,}$/i);
  return match ? match[1] : null;
}

// ─── SSO policy discovery ─────────────────────────────────────────────────────

export interface SsoDiscoveryResult {
  instanceArn: string;
  identityStoreId: string;
  permissionSetArn: string;
  permissionSetName: string;
  /** Managed policy ARNs attached to the permission set (AWS or customer-managed). */
  managedPolicyArns: string[];
  /** Customer-managed policy names (ARNs constructed using the account ID). */
  customerManagedPolicyArns: string[];
  hasInlinePolicy: boolean;
  inlinePolicyDocument?: string;
}

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

// AWS SSO Admin is a regional service — the instance lives in one fixed home
// region. We don't know which one, so probe in order of popularity.
const SSO_CANDIDATE_REGIONS = [
  "us-east-1",
  "us-west-2",
  "us-east-2",
  "us-west-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-northeast-1",
  "ap-south-1",
  "ca-central-1",
];

/**
 * Discover all policies attached to the SSO permission set that generated the
 * caller's temporary credentials.
 *
 * @param credentials  AWS credentials (AK + SK + optional session token)
 * @param accountId    AWS account ID from GetCallerIdentity
 * @param roleName     The assumed-role portion of the ARN, e.g. "AWSReservedSSO_AdminAccess_abc123"
 * @param hintRegion   Hint for which region to try first (the resource's configured region)
 */
export async function discoverSsoPermissionSetPolicies(
  credentials: AwsCredentials,
  accountId: string,
  roleName: string,
  hintRegion = "us-east-1"
): Promise<SsoDiscoveryResult | { error: string }> {
  const permissionSetName = extractPermissionSetFromRoleName(roleName);
  if (!permissionSetName) {
    return { error: `Could not parse permission set name from role "${roleName}"` };
  }

  // ── Step 1: Find the SSO instance (probe regions until we find it) ─────────
  // SSO Admin is regional — the instance's home region may differ from the
  // resource's region. Try the hint first, then fall back through common regions.
  const regionOrder = [
    hintRegion,
    ...SSO_CANDIDATE_REGIONS.filter((r) => r !== hintRegion),
  ];

  let instanceArn: string | null = null;
  let identityStoreId = "";
  let activeClient: SSOAdminClient | null = null;
  let lastError = "";

  for (const candidateRegion of regionOrder) {
    try {
      const tryClient = new SSOAdminClient({ region: candidateRegion, credentials });
      const resp = await tryClient.send(new ListInstancesCommand({}));
      const instance = resp.Instances?.[0];
      if (instance?.InstanceArn) {
        instanceArn = instance.InstanceArn;
        identityStoreId = instance.IdentityStoreId ?? "";
        activeClient = tryClient;
        break;
      }
    } catch (err: any) {
      lastError = err?.message ?? String(err);
      // Try next region
    }
  }

  if (!instanceArn || !activeClient) {
    return {
      error: lastError
        ? `Cannot access AWS IAM Identity Center: ${lastError}. Ensure the credentials have sso:ListInstances permission.`
        : "No AWS IAM Identity Center instance found in any supported region. Ensure Identity Center is enabled and credentials have sso:ListInstances permission.",
    };
  }

  const client = activeClient;

  // ── Step 2: Find the permission set ARN by name ───────────────────────────
  let permissionSetArn: string | null = null;
  let psToken: string | undefined;

  try {
    outer: do {
      const psResp = await client.send(
        new ListPermissionSetsProvisionedToAccountCommand({
          InstanceArn: instanceArn,
          AccountId: accountId,
          NextToken: psToken,
        })
      );

      for (const psArn of psResp.PermissionSets ?? []) {
        const desc = await client.send(
          new DescribePermissionSetCommand({ InstanceArn: instanceArn, PermissionSetArn: psArn })
        );
        if (desc.PermissionSet?.Name === permissionSetName) {
          permissionSetArn = psArn;
          break outer;
        }
      }

      psToken = psResp.NextToken;
    } while (psToken);
  } catch (err: any) {
    return {
      error: `Cannot list permission sets: ${err?.message ?? err}. Ensure the credentials have sso:ListPermissionSetsProvisionedToAccount permission.`,
    };
  }

  if (!permissionSetArn) {
    return {
      error: `Permission set "${permissionSetName}" not found in account ${accountId}. It may not be provisioned to this account.`,
    };
  }

  // ── Step 3: AWS managed policies ─────────────────────────────────────────
  const managedPolicyArns: string[] = [];
  try {
    let mpToken: string | undefined;
    do {
      const mpResp = await client.send(
        new ListManagedPoliciesInPermissionSetCommand({
          InstanceArn: instanceArn,
          PermissionSetArn: permissionSetArn,
          NextToken: mpToken,
        })
      );
      for (const p of mpResp.AttachedManagedPolicies ?? []) {
        if (p.Arn) managedPolicyArns.push(p.Arn);
      }
      mpToken = mpResp.NextToken;
    } while (mpToken);
  } catch {
    // Non-fatal: proceed with whatever we have
  }

  // ── Step 4: Customer-managed policy references ────────────────────────────
  const customerManagedPolicyArns: string[] = [];
  try {
    let cmpToken: string | undefined;
    do {
      const cmpResp = await client.send(
        new ListCustomerManagedPolicyReferencesInPermissionSetCommand({
          InstanceArn: instanceArn,
          PermissionSetArn: permissionSetArn,
          NextToken: cmpToken,
        })
      );
      for (const p of cmpResp.CustomerManagedPolicyReferences ?? []) {
        if (p.Name) {
          // Construct the ARN: customer managed policies live in the member account
          const path = p.Path ? p.Path.replace(/\/$/, "") : "";
          customerManagedPolicyArns.push(
            `arn:aws:iam::${accountId}:policy${path}/${p.Name}`
          );
        }
      }
      cmpToken = cmpResp.NextToken;
    } while (cmpToken);
  } catch {
    // Non-fatal
  }

  // ── Step 5: Inline policy ─────────────────────────────────────────────────
  let hasInlinePolicy = false;
  let inlinePolicyDocument: string | undefined;
  try {
    const inlineResp = await client.send(
      new GetInlinePolicyForPermissionSetCommand({
        InstanceArn: instanceArn,
        PermissionSetArn: permissionSetArn,
      })
    );
    const doc = inlineResp.InlinePolicy?.trim();
    if (doc && doc !== "{}") {
      hasInlinePolicy = true;
      inlinePolicyDocument = doc;
    }
  } catch {
    // No inline policy or no permission
  }

  return {
    instanceArn,
    identityStoreId,
    permissionSetArn,
    permissionSetName,
    managedPolicyArns,
    customerManagedPolicyArns,
    hasInlinePolicy,
    inlinePolicyDocument,
  };
}
