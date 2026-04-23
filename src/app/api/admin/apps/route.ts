import { NextRequest, NextResponse } from "next/server";
import { brokerSessionService } from "@/server/services/broker-session.service";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { isAdminOrAbove, getOrgFilter, canManageOrg } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const resources = await prisma.resource.findMany({
      where: { ...getOrgFilter(auth) },
      include: { accounts: true, organization: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(resources);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    if (!data.resourceKey || !data.name || !data.appHost) {
      return badRequest("Missing required fields (resourceKey, name, appHost)");
    }

    // Validate org scope for non-super-admins
    if (data.organizationId && !canManageOrg(auth, data.organizationId)) {
      return forbidden("You do not have access to this organization");
    }

    // Strip frontend-only fields (managedUsername, managedPassword) before persisting
    const resourceData = {
      resourceKey: data.resourceKey,
      name: data.name,
      description: data.description,
      appHost: data.appHost,
      apiHost: data.apiHost,
      loginUrl: data.loginUrl,
      loginAdapter: data.loginAdapter,
      tokenExtractionPath: data.tokenExtractionPath || null,
      tokenValidationPath: data.tokenValidationPath || null,
      magicLinkExtractionPath: data.magicLinkExtractionPath?.trim() || null,
      loginPayloadTemplate: data.loginPayloadTemplate?.trim() || null,
      usernameField: data.usernameField || null,
      passwordField: data.passwordField || null,
      environment: data.environment,
      organizationId: data.organizationId || null,
    };
    const resource = await brokerSessionService.createResource(resourceData);

    // Auto-create a default managed account for this application
    await brokerSessionService.addManagedAccount({
      resourceId: resource.id,
      accountKey: "default-admin",
      vaultPath: `secret/apps/${data.resourceKey}/admin`,
      label: "Default Admin Account",
      role: "admin",
    });

    return NextResponse.json(resource, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (!isAdminOrAbove(auth)) return forbidden();

    const data = await req.json();
    if (!data.id || !data.resourceKey || !data.name || !data.appHost) {
      return badRequest("Missing required fields (id, resourceKey, name, appHost)");
    }

    // Verify the existing resource is in the admin's org scope
    const existing = await prisma.resource.findUnique({ where: { id: data.id } });
    if (!existing) return badRequest("Resource not found");
    if (!canManageOrg(auth, existing.organizationId)) {
      return forbidden("You do not have access to this resource's organization");
    }

    // If changing org, verify new org is also in scope
    if (data.organizationId && data.organizationId !== existing.organizationId) {
      if (!canManageOrg(auth, data.organizationId)) {
        return forbidden("You do not have access to the target organization");
      }
    }

    const updated = await prisma.resource.update({
      where: { id: data.id },
      data: {
        resourceKey: data.resourceKey,
        name: data.name,
        description: data.description,
        appHost: data.appHost,
        apiHost: data.apiHost,
        loginUrl: data.loginUrl,
        loginAdapter: data.loginAdapter,
        tokenExtractionPath: data.tokenExtractionPath || null,
        tokenValidationPath: data.tokenValidationPath || null,
        magicLinkExtractionPath: data.magicLinkExtractionPath?.trim() || null,
        loginPayloadTemplate: data.loginPayloadTemplate?.trim() || null,
        usernameField: data.usernameField || null,
        passwordField: data.passwordField || null,
        environment: data.environment,
        isActive: data.isActive,
        organizationId: data.organizationId ?? existing.organizationId,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}
