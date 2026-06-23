import { NextRequest, NextResponse } from "next/server";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import {
  IAMClient,
  ListAttachedUserPoliciesCommand,
  ListAttachedRolePoliciesCommand,
  ListGroupsForUserCommand,
  ListAttachedGroupPoliciesCommand,
  GetPolicyCommand,
} from "@aws-sdk/client-iam";
import { getAuthContext, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-helpers";
import { isAdminOrAbove } from "@/lib/auth-policy";
import { secretManager } from "@/server/secrets/secret-manager";

// ─── Static cross-service implications ───────────────────────────────────────
// Global policies (Admin, PowerUser, ReadOnly) that imply other global policies.
// Per-service FullAccess → ReadOnlyAccess is handled dynamically below.

// Common AWS managed FullAccess policies that the dynamic step will derive
// ReadOnly variants for. Keep this list in sync with well-known AWS managed
// policies — the dynamic GetPolicy verify step filters out any that don't exist.
const COMMON_FULL_ACCESS_ARNS = [
  "arn:aws:iam::aws:policy/AmazonEC2FullAccess",
  "arn:aws:iam::aws:policy/AmazonS3FullAccess",
  "arn:aws:iam::aws:policy/AmazonRDSFullAccess",
  "arn:aws:iam::aws:policy/AWSLambda_FullAccess",
  "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
  "arn:aws:iam::aws:policy/AmazonRoute53FullAccess",
  "arn:aws:iam::aws:policy/AmazonSNSFullAccess",
  "arn:aws:iam::aws:policy/AmazonSQSFullAccess",
  "arn:aws:iam::aws:policy/AmazonECSFullAccess",
  "arn:aws:iam::aws:policy/AmazonElastiCacheFullAccess",
  "arn:aws:iam::aws:policy/AmazonRedshiftFullAccess",
  "arn:aws:iam::aws:policy/AmazonKinesisFullAccess",
  "arn:aws:iam::aws:policy/AmazonCognitoPowerUser",
  "arn:aws:iam::aws:policy/AWSCodeDeployFullAccess",
  "arn:aws:iam::aws:policy/AWSCodePipelineFullAccess",
  "arn:aws:iam::aws:policy/AWSCloudFormationFullAccess",
  "arn:aws:iam::aws:policy/AmazonKinesisFirehoseFullAccess",
  "arn:aws:iam::aws:policy/AmazonMQFullAccess",
  "arn:aws:iam::aws:policy/AWSGlueConsoleFullAccess",
  "arn:aws:iam::aws:policy/AmazonOpenSearchServiceFullAccess",
  "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
  "arn:aws:iam::aws:policy/AWSStepFunctionsFullAccess",
  "arn:aws:iam::aws:policy/AmazonEventBridgeFullAccess",
  "arn:aws:iam::aws:policy/AWSAppSyncAdministrator",
  "arn:aws:iam::aws:policy/CloudFrontFullAccess",
  "arn:aws:iam::aws:policy/AWSWAFFullAccess",
  "arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator",
  "arn:aws:iam::aws:policy/AmazonSSMFullAccess",
  "arn:aws:iam::aws:policy/AWSSecretsManagerReadWrite",
  "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess",
  "arn:aws:iam::aws:policy/AWSBatchFullAccess",
  "arn:aws:iam::aws:policy/AmazonWorkMailFullAccess",
  "arn:aws:iam::aws:policy/AmazonLexFullAccess",
  "arn:aws:iam::aws:policy/AmazonPollyFullAccess",
  "arn:aws:iam::aws:policy/AmazonRekognitionFullAccess",
  "arn:aws:iam::aws:policy/AmazonTranscribeFullAccess",
  "arn:aws:iam::aws:policy/AmazonTranslateFullAccess",
  "arn:aws:iam::aws:policy/AWSIoTFullAccess",
  "arn:aws:iam::aws:policy/AmazonFraudDetectorFullAccessPolicy",
  "arn:aws:iam::aws:policy/AmazonTimestreamFullAccess",
  "arn:aws:iam::aws:policy/AmazonQLDBFullAccess",
];

const STATIC_IMPLIES: Record<string, string[]> = {
  // AdministratorAccess implies every global and every common FullAccess policy.
  // The dynamic step then derives ReadOnly variants for all FullAccess entries.
  "arn:aws:iam::aws:policy/AdministratorAccess": [
    "arn:aws:iam::aws:policy/PowerUserAccess",
    "arn:aws:iam::aws:policy/ReadOnlyAccess",
    "arn:aws:iam::aws:policy/ViewOnlyAccess",
    "arn:aws:iam::aws:policy/SecurityAudit",
    "arn:aws:iam::aws:policy/job-function/Billing",
    "arn:aws:iam::aws:policy/job-function/DatabaseAdministrator",
    "arn:aws:iam::aws:policy/job-function/DataScientistAccess",
    "arn:aws:iam::aws:policy/job-function/NetworkAdministrator",
    "arn:aws:iam::aws:policy/job-function/SupportUser",
    "arn:aws:iam::aws:policy/job-function/SystemAdministrator",
    "arn:aws:iam::aws:policy/aws-service-role/AWSSSOMemberAccountAdministrator",
    "arn:aws:iam::aws:policy/aws-service-role/AWSSSODirectoryAdministrator",
    "arn:aws:iam::aws:policy/aws-service-role/AWSSSOReadOnly",
    ...COMMON_FULL_ACCESS_ARNS,
  ],
  "arn:aws:iam::aws:policy/PowerUserAccess": [
    "arn:aws:iam::aws:policy/ReadOnlyAccess",
    "arn:aws:iam::aws:policy/ViewOnlyAccess",
    "arn:aws:iam::aws:policy/SecurityAudit",
    "arn:aws:iam::aws:policy/job-function/DatabaseAdministrator",
    "arn:aws:iam::aws:policy/job-function/DataScientistAccess",
    "arn:aws:iam::aws:policy/job-function/NetworkAdministrator",
    "arn:aws:iam::aws:policy/job-function/SupportUser",
    "arn:aws:iam::aws:policy/job-function/SystemAdministrator",
    "arn:aws:iam::aws:policy/aws-service-role/AWSSSOReadOnly",
    ...COMMON_FULL_ACCESS_ARNS,
  ],
  "arn:aws:iam::aws:policy/ReadOnlyAccess": [
    "arn:aws:iam::aws:policy/ViewOnlyAccess",
    "arn:aws:iam::aws:policy/SecurityAudit",
    "arn:aws:iam::aws:policy/job-function/SupportUser",
    "arn:aws:iam::aws:policy/aws-service-role/AWSSSOReadOnly",
  ],
  "arn:aws:iam::aws:policy/SecurityAudit": [
    "arn:aws:iam::aws:policy/ViewOnlyAccess",
    "arn:aws:iam::aws:policy/aws-service-role/AWSSSOReadOnly",
  ],
  "arn:aws:iam::aws:policy/aws-service-role/AWSSSOMemberAccountAdministrator": [
    "arn:aws:iam::aws:policy/aws-service-role/AWSSSODirectoryAdministrator",
    "arn:aws:iam::aws:policy/aws-service-role/AWSSSOReadOnly",
  ],
  "arn:aws:iam::aws:policy/aws-service-role/AWSSSODirectoryAdministrator": [
    "arn:aws:iam::aws:policy/aws-service-role/AWSSSOReadOnly",
  ],
};

// For any AWS managed FullAccess policy, derive the candidate ReadOnlyAccess
// ARN by substituting the suffix. AWS naming isn't 100% consistent so we verify
// each candidate exists via GetPolicy before adding it.
function deriveReadOnlyCandidates(arns: Set<string>): string[] {
  const candidates: string[] = [];
  for (const arn of arns) {
    // Only derive for AWS managed policies (account = "aws")
    if (!arn.startsWith("arn:aws:iam::aws:policy/")) continue;
    if (!arn.includes("FullAccess")) continue;

    // Try both common patterns AWS uses
    candidates.push(arn.replace("FullAccess", "ReadOnlyAccess"));

    // AWSLambda_FullAccess → AWSLambdaReadOnlyAccess (underscore dropped)
    if (arn.includes("_FullAccess")) {
      candidates.push(arn.replace("_FullAccess", "ReadOnlyAccess"));
    }
  }
  // Deduplicate and exclude any that are already directly attached
  return [...new Set(candidates)].filter((c) => !arns.has(c));
}

/**
 * POST /api/admin/aws/policies
 * Returns managed policy ARNs the broker principal can grant, including safe
 * downscoped subsets (e.g. EC2FullAccess → EC2ReadOnlyAccess).
 * Accepts either:
 *   { accessKeyId, secretAccessKey, region? }  — explicit credentials
 *   { resourceKey, region? }                   — load stored credentials for an existing resource
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const body = await req.json();
    let { accessKeyId, secretAccessKey, region = "us-east-1" } = body;

    // If a resourceKey is provided, load credentials from the secret manager
    if (body.resourceKey && (!accessKeyId || !secretAccessKey)) {
      const secretRef = `aws/resource/${body.resourceKey}`;
      try {
        const secret = await secretManager.getSecret(secretRef, "aws_iam_credentials");
        accessKeyId = secret.payload.accessKeyId;
        secretAccessKey = secret.payload.secretAccessKey;
      } catch {
        return badRequest(`No stored credentials found for resource '${body.resourceKey}'. Enter the keys manually.`);
      }
    }

    if (!accessKeyId || !secretAccessKey) {
      return badRequest("Provide either accessKeyId + secretAccessKey, or a resourceKey with stored credentials.");
    }

    const credentials = {
      accessKeyId: String(accessKeyId).trim(),
      secretAccessKey: String(secretAccessKey).trim(),
    };

    // Step 1: Identify who these keys belong to
    const sts = new STSClient({ region, credentials });
    let callerArn: string;
    let callerType: "user" | "role" | "unknown";
    let principalName: string;

    try {
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      callerArn = identity.Arn ?? "";
      if (callerArn.includes(":user/")) {
        callerType = "user";
        principalName = callerArn.split(":user/").pop() ?? "";
      } else if (callerArn.includes(":assumed-role/")) {
        callerType = "role";
        principalName = callerArn.split(":assumed-role/").pop()?.split("/")[0] ?? "";
      } else if (callerArn.includes(":role/")) {
        callerType = "role";
        principalName = callerArn.split(":role/").pop() ?? "";
      } else {
        callerType = "unknown";
        principalName = "";
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid credentials or no sts:GetCallerIdentity permission." },
        { status: 400 }
      );
    }

    const iam = new IAMClient({ region: "us-east-1", credentials });
    const attachedArns = new Set<string>();

    // Step 2: List directly-attached policies
    if (callerType === "user" && principalName) {
      // Direct user policies
      try {
        let marker: string | undefined;
        do {
          const resp = await iam.send(
            new ListAttachedUserPoliciesCommand({ UserName: principalName, Marker: marker })
          );
          for (const p of resp.AttachedPolicies ?? []) {
            if (p.PolicyArn) attachedArns.add(p.PolicyArn);
          }
          marker = resp.IsTruncated ? resp.Marker : undefined;
        } while (marker);
      } catch {
        // iam:ListAttachedUserPolicies not permitted — continue with group check
      }

      // Group-level policies
      try {
        let marker: string | undefined;
        do {
          const groupsResp = await iam.send(
            new ListGroupsForUserCommand({ UserName: principalName, Marker: marker })
          );
          for (const group of groupsResp.Groups ?? []) {
            try {
              let gMarker: string | undefined;
              do {
                const gResp = await iam.send(
                  new ListAttachedGroupPoliciesCommand({ GroupName: group.GroupName!, Marker: gMarker })
                );
                for (const p of gResp.AttachedPolicies ?? []) {
                  if (p.PolicyArn) attachedArns.add(p.PolicyArn);
                }
                gMarker = gResp.IsTruncated ? gResp.Marker : undefined;
              } while (gMarker);
            } catch {
              // skip group if we can't list its policies
            }
          }
          marker = groupsResp.IsTruncated ? groupsResp.Marker : undefined;
        } while (marker);
      } catch {
        // iam:ListGroupsForUser not permitted — skip group policies
      }
    } else if (callerType === "role" && principalName) {
      try {
        let marker: string | undefined;
        do {
          const resp = await iam.send(
            new ListAttachedRolePoliciesCommand({ RoleName: principalName, Marker: marker })
          );
          for (const p of resp.AttachedPolicies ?? []) {
            if (p.PolicyArn) attachedArns.add(p.PolicyArn);
          }
          marker = resp.IsTruncated ? resp.Marker : undefined;
        } while (marker);
      } catch {
        // iam:ListAttachedRolePolicies not permitted — partial results
      }
    }

    // Step 3: Apply static cross-service implications (Admin → PowerUser etc.)
    const result = new Set<string>(attachedArns);
    for (const arn of attachedArns) {
      for (const implied of STATIC_IMPLIES[arn] ?? []) {
        result.add(implied);
      }
    }

    // Step 4: Dynamically derive ReadOnly variants for every FullAccess policy,
    // then verify each candidate exists in AWS before adding it.
    const candidates = deriveReadOnlyCandidates(result);
    if (candidates.length > 0) {
      await Promise.all(
        candidates.map(async (candidateArn) => {
          try {
            await iam.send(new GetPolicyCommand({ PolicyArn: candidateArn }));
            result.add(candidateArn);
          } catch {
            // Policy doesn't exist in AWS — skip
          }
        })
      );
    }

    return NextResponse.json({
      callerArn,
      callerType,
      principalName,
      directPolicyArns: Array.from(attachedArns),
      policyArns: Array.from(result),
    });
  } catch (err) {
    return serverError(err);
  }
}
