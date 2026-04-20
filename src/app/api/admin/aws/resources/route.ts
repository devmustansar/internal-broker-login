import { NextRequest, NextResponse } from "next/server";
import { awsBrokerService } from "@/server/services/aws-broker.service";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, getOrgFilter, canManageOrg } from "@/lib/auth-policy";
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

    // Required fields
    const required = ["resourceKey", "name", "awsAccountId", "roleArn", "brokerCredentialRef"] as const;
    for (const field of required) {
      if (!body[field] || typeof body[field] !== "string") {
        return badRequest(`Missing or invalid required field: '${field}'`);
      }
    }

    // Validate roleArn format
    if (!body.roleArn.startsWith("arn:aws:iam::")) {
      return badRequest("roleArn must be a valid IAM role ARN (arn:aws:iam::...)");
    }

    // Validate resourceKey format
    if (!/^[a-z0-9_-]+$/i.test(body.resourceKey)) {
      return badRequest("resourceKey must only contain letters, numbers, hyphens, and underscores");
    }

    // Validate org scope
    if (body.organizationId && !canManageOrg(auth, body.organizationId)) {
      return forbidden("You do not have access to this organization");
    }

    const resource = await awsBrokerService.createAwsResource({
      resourceKey: body.resourceKey,
      name: body.name,
      description: body.description,
      awsAccountId: body.awsAccountId,
      roleArn: body.roleArn,
      region: body.region ?? "us-east-1",
      destination: body.destination ?? "https://console.aws.amazon.com/",
      issuer: body.issuer ?? "internal-broker",
      sessionDurationSeconds: Number(body.sessionDurationSeconds ?? 3600),
      externalId: body.externalId,
      brokerCredentialRef: body.brokerCredentialRef,
      stsStrategy: body.stsStrategy ?? "assume_role",
      environment: body.environment ?? "production",
      organizationId: body.organizationId || null,
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
    if (!data.id || !data.resourceKey || !data.name || !data.awsAccountId || !data.roleArn || !data.brokerCredentialRef) {
      return badRequest("Missing required fields (id, resourceKey, name, awsAccountId, roleArn, brokerCredentialRef)");
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
        description: data.description,
        awsAccountId: data.awsAccountId,
        roleArn: data.roleArn,
        region: data.region,
        destination: data.destination,
        issuer: data.issuer,
        sessionDurationSeconds: Number(data.sessionDurationSeconds),
        externalId: data.externalId,
        brokerCredentialRef: data.brokerCredentialRef,
        stsStrategy: data.stsStrategy,
        isActive: data.isActive,
        environment: data.environment,
        organizationId: data.organizationId ?? existing.organizationId,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}
