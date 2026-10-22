import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/api-helpers";
import { appAccessService } from "@/server/services/app-access.service";
import { auditLogService } from "@/server/services/audit.service";
import { PORTFOLIO_RESOURCE_KEY } from "@/lib/constants";

// Serves the static portfolio hub (built by `npm run sync:portfolio` into
// portfolio-content/, deliberately outside public/ so nothing is reachable
// except through this handler). Every file — pages, assets, prototypes — goes
// through the same session + resource-assignment check.

const ROOT = path.resolve(process.cwd(), "portfolio-content");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".map": "application/json; charset=utf-8",
};

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
};

const notFound = () =>
  new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });

const redirect = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { location, ...PRIVATE_HEADERS },
  });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const auth = await getAuthContext(req);
  if (!auth) return redirect("/");

  // Unassigned users get a 404 rather than a 403 so the portfolio's existence
  // isn't confirmed to them.
  const allowed =
    auth.role === "super_admin" ||
    (await appAccessService.canUserAccessResource(
      auth.userId,
      PORTFOLIO_RESOURCE_KEY,
    ));
  const resource = allowed
    ? await appAccessService.getResourceByKey(PORTFOLIO_RESOURCE_KEY)
    : null;
  if (!resource) return notFound();

  const { path: segments = [] } = await params;
  const resolved = path.resolve(ROOT, ...segments);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    return notFound();
  }

  let filePath = resolved;
  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    return notFound();
  }

  try {
    const file = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".html") {
      auditLogService.log({
        action: "access_granted",
        internalUserId: auth.userId,
        resourceKey: PORTFOLIO_RESOURCE_KEY,
        outcome: "success",
        details: { path: req.nextUrl.pathname },
      });
    }
    return new Response(file, {
      headers: {
        "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
        ...PRIVATE_HEADERS,
      },
    });
  } catch {
    return notFound();
  }
}
