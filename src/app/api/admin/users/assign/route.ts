import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, isSuperAdmin } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

/** Shared: resolve user + resource and run org-scope checks. */
async function resolveAndAuthorize(
  auth: Awaited<ReturnType<typeof getAuthContext>>,
  email: string,
  resourceKey: string
) {
  const webResource = await prisma.resource.findUnique({ where: { resourceKey } });
  const awsResource = await prisma.awsResource.findUnique({ where: { resourceKey } });
  const resource = webResource || awsResource;
  if (!resource) return { error: `Resource not found: ${resourceKey}` };

  if (!isSuperAdmin(auth!)) {
    const orgId = (resource as any).organizationId;
    if (orgId && !(auth!.organizationIds || []).includes(orgId)) {
      return { error: "You can only manage resources from your own organizations" };
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: `User not found: ${email}` };

  if (!isSuperAdmin(auth!)) {
    const sharedOrgs = await prisma.userOrganization.findMany({
      where: { userId: user.id, organizationId: { in: auth!.organizationIds || [] } },
    });
    if (sharedOrgs.length === 0) {
      return { error: "You can only manage resources for team members within your organizations" };
    }
  }

  return { user, awsResource, webResource };
}

/**
 * POST /api/admin/users/assign
 * Assign a resource to a user, optionally with AWS session policies.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    const { email, resourceKey, policyArns } = data;
    if (!email || !resourceKey) return badRequest("Missing required fields (email, resourceKey)");

    const resolved = await resolveAndAuthorize(auth, email, resourceKey);
    if (resolved.error) return badRequest(resolved.error);
    const { user, awsResource } = resolved;

    // Grant access
    if (!user!.allowedResourceKeys.includes("*") && !user!.allowedResourceKeys.includes(resourceKey)) {
      await prisma.user.update({
        where: { id: user!.id },
        data: { allowedResourceKeys: { push: resourceKey } },
      });
    }

    // Upsert AWS session policies if provided
    if (awsResource && Array.isArray(policyArns)) {
      const available = awsResource.availablePolicyArns || [];
      if (available.length > 0) {
        const invalid = policyArns.filter((arn: string) => !available.includes(arn));
        if (invalid.length > 0) {
          return badRequest(`Invalid policy ARNs not in available list: ${invalid.join(", ")}`);
        }
      }
      await prisma.userAwsPolicy.upsert({
        where: { userId_awsResourceId: { userId: user!.id, awsResourceId: awsResource.id } },
        update: { policyArns },
        create: { userId: user!.id, awsResourceId: awsResource.id, policyArns },
      });
    }

    return NextResponse.json({
      message: awsResource
        ? `Resource assigned with ${(policyArns || []).length} session policy(ies)`
        : "Resource assigned successfully",
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * PATCH /api/admin/users/assign
 * Update AWS session policies for an already-assigned resource.
 * Body: { email, resourceKey, policyArns: string[] }
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    const { email, resourceKey, policyArns } = data;
    if (!email || !resourceKey || !Array.isArray(policyArns)) {
      return badRequest("Missing required fields (email, resourceKey, policyArns)");
    }

    const resolved = await resolveAndAuthorize(auth, email, resourceKey);
    if (resolved.error) return badRequest(resolved.error);
    const { user, awsResource } = resolved;

    if (!awsResource) return badRequest("Policy updates are only applicable to AWS resources");

    const available = awsResource.availablePolicyArns || [];
    if (available.length > 0) {
      const invalid = policyArns.filter((arn: string) => !available.includes(arn));
      if (invalid.length > 0) {
        return badRequest(`Invalid policy ARNs not in available list: ${invalid.join(", ")}`);
      }
    }

    await prisma.userAwsPolicy.upsert({
      where: { userId_awsResourceId: { userId: user!.id, awsResourceId: awsResource.id } },
      update: { policyArns },
      create: { userId: user!.id, awsResourceId: awsResource.id, policyArns },
    });

    return NextResponse.json({ message: `Updated ${policyArns.length} session policy(ies) for ${email}` });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * DELETE /api/admin/users/assign
 * Remove a resource from a user (revoke access + delete AWS policy record).
 * Body: { email, resourceKey }
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    const { email, resourceKey } = data;
    if (!email || !resourceKey) return badRequest("Missing required fields (email, resourceKey)");

    const resolved = await resolveAndAuthorize(auth, email, resourceKey);
    if (resolved.error) return badRequest(resolved.error);
    const { user, awsResource } = resolved;

    // Remove from allowedResourceKeys
    await prisma.user.update({
      where: { id: user!.id },
      data: {
        allowedResourceKeys: user!.allowedResourceKeys.filter((k) => k !== resourceKey),
      },
    });

    // Delete AWS session policy record if exists
    if (awsResource) {
      await prisma.userAwsPolicy.deleteMany({
        where: { userId: user!.id, awsResourceId: awsResource.id },
      });
    }

    return NextResponse.json({ message: `Access to "${resourceKey}" revoked from ${email}` });
  } catch (err) {
    return serverError(err);
  }
}
