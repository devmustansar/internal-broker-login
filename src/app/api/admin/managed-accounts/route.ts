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
    if (!data.resourceId || !data.accountKey || !data.vaultPath || !data.label) {
      return badRequest("Missing required fields (resourceId, accountKey, vaultPath, label)");
    }

    const ma = await brokerSessionService.addManagedAccount(data);

    return NextResponse.json(ma, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
