import { NextRequest, NextResponse } from "next/server";
import { brokerSessionService } from "@/server/services/broker-session.service";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();
    if (auth.role !== "admin") return forbidden();

    const resources = await prisma.resource.findMany({
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
    if (auth.role !== "admin") return forbidden();

    const data = await req.json();
    if (!data.resourceKey || !data.name || !data.appHost) {
      return badRequest("Missing required fields (resourceKey, name, appHost)");
    }

    const resource = await brokerSessionService.createResource(data);

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
    if (auth.role !== "admin") return forbidden();

    const data = await req.json();
    if (!data.id || !data.resourceKey || !data.name || !data.appHost) {
      return badRequest("Missing required fields (id, resourceKey, name, appHost)");
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
        tokenExtractionPath: data.tokenExtractionPath,
        tokenValidationPath: data.tokenValidationPath,
        usernameField: data.usernameField,
        passwordField: data.passwordField,
        environment: data.environment,
        isActive: data.isActive,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}
