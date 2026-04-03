import { NextRequest, NextResponse } from "next/server";
import { brokerSessionService } from "@/server/services/broker-session.service";
import {
  getAuthContext,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api-helpers";
import type { OpenAppRequest } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const body = (await req.json()) as Partial<OpenAppRequest>;
    const { resourceKey, deviceId, browser } = body;

    if (!resourceKey || typeof resourceKey !== "string") {
      return badRequest("resourceKey is required");
    }

    const { headers } = req;
    const userAgent = headers.get("user-agent") || "unknown";

    const result = await brokerSessionService.openApp(auth.userId, {
      resourceKey,
      deviceId: deviceId || "unknown-device",
      browser: browser || userAgent,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
