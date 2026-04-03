import { NextRequest, NextResponse } from "next/server";
import { brokerSessionService } from "@/server/services/broker-session.service";
import {
  getAuthContext,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-helpers";

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
