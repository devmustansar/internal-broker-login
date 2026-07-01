import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { awsBrokerService } from "@/server/services/aws-broker.service";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, isSuperAdmin, getOrgFilter, canManageOrg, isOrgOwner } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/aws/resources
 * Lists AWS resources scoped to the admin's organizations.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const resources = await prisma.awsResource.findMany({
      where: { isActive: true, ...getOrgFilter(auth) },
      include: { organization: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(resources);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * POST /api/admin/aws/resources
 * Provisions a new AWS Console resource (org-scoped).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const body = await req.json();

    // Required fields (resourceKey is auto-generated — not accepted from client)
    const required = ["name", "awsAccountId"] as const;
    for (const field of required) {
      if (!body[field] || typeof body[field] !== "string") {
        return badRequest(`Missing or invalid required field: '${field}'`);
      }
    }

    const strategy = body.stsStrategy ?? "assume_role";

    if (strategy === "assume_role") {
      if (!body.roleArn || typeof body.roleArn !== "string") {
        return badRequest("roleArn is required when stsStrategy is 'assume_role'");
      }
      if (!body.roleArn.startsWith("arn:aws:iam::")) {
        return badRequest("roleArn must be a valid IAM role ARN (arn:aws:iam::...)");
      }
      if (body.roleArn.includes(":user/")) {
        return badRequest(
          `roleArn '${body.roleArn}' is an IAM user ARN, not a role ARN. ` +
          `AssumeRole requires arn:aws:iam::ACCOUNT:role/ROLE_NAME. ` +
          `Either fix the ARN or change stsStrategy to 'federation_token'.`
        );
      }
    }

    if (strategy === "aws_sso") {
      if (!body.ssoStartUrl || typeof body.ssoStartUrl !== "string") {
        return badRequest("ssoStartUrl is required when stsStrategy is 'aws_sso'");
      }
      if (!body.ssoStartUrl.startsWith("https://")) {
        return badRequest("ssoStartUrl must be a valid HTTPS URL");
      }
    }

    // Validate org scope
    if (body.organizationId && !canManageOrg(auth, body.organizationId)) {
      return forbidden("You do not have access to this organization");
    }

    // Auto-generate a unique, immutable resource key
    const resourceKey = uuidv4();

    const resource = await awsBrokerService.createAwsResource({
      resourceKey,
      name: body.name,
      description: body.description,
      awsAccountId: body.awsAccountId,
      roleArn: body.roleArn ?? "",
      region: body.region ?? "us-east-1",
      destination: body.destination ?? "https://console.aws.amazon.com/",
      issuer: body.issuer ?? "internal-broker",
      sessionDurationSeconds: Number(body.sessionDurationSeconds ?? 3600),
      externalId: body.externalId,
      brokerCredentialRef: `aws/resource/${resourceKey}`,
      stsStrategy: body.stsStrategy ?? "assume_role",
      ssoStartUrl: body.ssoStartUrl?.trim() || null,
      ssoPermissionSetName: body.ssoPermissionSetName?.trim() || null,
      ssoRegion: body.ssoRegion?.trim() || null,
      environment: body.environment ?? "production",
      organizationId: body.organizationId || null,
      availablePolicyArns: Array.isArray(body.availablePolicyArns) ? body.availablePolicyArns : [],
      sessionName: body.sessionName?.trim() || null,
    });

    return NextResponse.json(resource, { status: 201 });
  } catch (err) {
    // Unique constraint violation
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "An AWS resource with this resourceKey already exists" },
        { status: 409 }
      );
    }
    return serverError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    if (!data.id || !data.name || !data.awsAccountId) {
      return badRequest("Missing required fields (id, name, awsAccountId)");
    }

    const putStrategy = data.stsStrategy ?? "assume_role";
    if (putStrategy === "assume_role") {
      if (!data.roleArn) {
        return badRequest("roleArn is required when stsStrategy is 'assume_role'");
      }
      if (data.roleArn.includes(":user/")) {
        return badRequest(
          `roleArn '${data.roleArn}' is an IAM user ARN, not a role ARN. ` +
          `AssumeRole requires arn:aws:iam::ACCOUNT:role/ROLE_NAME. ` +
          `Either fix the ARN or change stsStrategy to 'federation_token'.`
        );
      }
    }

    if (putStrategy === "aws_sso") {
      if (!data.ssoStartUrl || !data.ssoStartUrl.startsWith("https://")) {
        return badRequest("ssoStartUrl is required and must be a valid HTTPS URL when stsStrategy is 'aws_sso'");
      }
    }

    // Verify org scope on existing resource
    const existing = await prisma.awsResource.findUnique({ where: { id: data.id } });
    if (!existing) return badRequest("AWS Resource not found");
    if (!canManageOrg(auth, existing.organizationId)) {
      return forbidden("You do not have access to this resource's organization");
    }

    if (data.organizationId && data.organizationId !== existing.organizationId) {
      if (!canManageOrg(auth, data.organizationId)) {
        return forbidden("You do not have access to the target organization");
      }
    }

    const updated = await prisma.awsResource.update({
      where: { id: data.id },
      data: {
        resourceKey: data.resourceKey,
        name: data.name,
        description: data.description || null,
        awsAccountId: data.awsAccountId,
        roleArn: data.roleArn,
        region: data.region,
        destination: data.destination,
        issuer: data.issuer,
        sessionDurationSeconds: Number(data.sessionDurationSeconds),
        externalId: data.externalId || null,
        brokerCredentialRef: `aws/resource/${existing.resourceKey}`,
        stsStrategy: data.stsStrategy,
        ssoStartUrl: data.ssoStartUrl?.trim() || null,
        ssoPermissionSetName: data.ssoPermissionSetName?.trim() || null,
        ssoRegion: data.ssoRegion?.trim() || null,
        sessionName: data.sessionName?.trim() || null,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        environment: data.environment,
        ...(data.organizationId || existing.organizationId
          ? {
              organization: data.organizationId
                ? { connect: { id: data.organizationId } }
                : { connect: { id: existing.organizationId! } }
            }
          : {
              organization: { disconnect: true }
            }),
        ...(Array.isArray(data.availablePolicyArns) ? { availablePolicyArns: data.availablePolicyArns } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/aws/resources
 * Org owners and super admins can delete an AWS resource and all its dependencies.
 * Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const { id } = await req.json();
    if (!id) return badRequest("Missing required field: id");

    const existing = await prisma.awsResource.findUnique({ where: { id } });
    if (!existing) return badRequest("AWS Resource not found");

    const canDelete = existing.organizationId
      ? isOrgOwner(auth, existing.organizationId)
      : isSuperAdmin(auth);
    if (!canDelete) return forbidden("Only organization owners or super admins can delete resources");

    await prisma.$transaction(async (tx) => {
      await tx.userAwsPolicy.deleteMany({ where: { awsResourceId: id } });
      // UserResourceAccess cascades via schema; delete explicitly for clarity
      await tx.userResourceAccess.deleteMany({ where: { awsResourceId: id } });
      await tx.awsResource.delete({ where: { id } });
    });

    return NextResponse.json({ message: "AWS resource deleted successfully" });
  } catch (err) {
    return serverError(err);
  }
}
