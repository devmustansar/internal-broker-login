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

    // Required fields (resourceKey is auto-generated — not accepted from client)
    const required = ["name", "awsAccountId", "roleArn"] as const;
    for (const field of required) {
      if (!body[field] || typeof body[field] !== "string") {
        return badRequest(`Missing or invalid required field: '${field}'`);
      }
    }

    // Validate roleArn format
    if (!body.roleArn.startsWith("arn:aws:iam::")) {
      return badRequest("roleArn must be a valid IAM role ARN (arn:aws:iam::...)");
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
      roleArn: body.roleArn,
      region: body.region ?? "us-east-1",
      destination: body.destination ?? "https://console.aws.amazon.com/",
      issuer: body.issuer ?? "internal-broker",
      sessionDurationSeconds: Number(body.sessionDurationSeconds ?? 3600),
      externalId: body.externalId,
      brokerCredentialRef: `aws/resource/${resourceKey}`,
      stsStrategy: body.stsStrategy ?? "assume_role",
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
    if (!data.id || !data.name || !data.awsAccountId || !data.roleArn) {
      return badRequest("Missing required fields (id, name, awsAccountId, roleArn)");
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
