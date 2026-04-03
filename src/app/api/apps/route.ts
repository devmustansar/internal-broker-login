import { NextRequest, NextResponse } from "next/server";
import { appAccessService } from "@/server/services/app-access.service";
import { getAuthContext, unauthorized, serverError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return unauthorized();

    const user = await appAccessService.getUserById(auth.userId);
    if (!user) return unauthorized("User not found");

    const allResources = await appAccessService.getAllResources();

    // Filter to only resources the user can access
    const accessible =
      user.allowedResourceKeys.includes("*")
        ? allResources
        : allResources.filter((r) =>
            user.allowedResourceKeys.includes(r.resourceKey)
          );

    return NextResponse.json(accessible);
  } catch (err) {
    return serverError(err);
  }
}
