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
    if (!data.email || !data.name || !data.role) {
      return badRequest("Missing required fields (email, name, role)");
    }

    // Since it's a POC, we just store it plainly in passwordHash or hash it.
    // We'll store directly so mock login can verify it smoothly.
    const createData = {
      ...data,
      passwordHash: data.password || "password123", // fallback
    };
    
    // remove plain password from prisma data object
    delete createData.password;

    const user = await brokerSessionService.createUser(createData);

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
