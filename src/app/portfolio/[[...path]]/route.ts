import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
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

const ROBOTS = { "x-robots-tag": "noindex, nofollow" };

// Pages are never cached so access changes apply on the next navigation.
// Sub-resources are cached by the browser only ("private" keeps shared
// caches/CDNs out): hashed _next/static files for good, the rest briefly.
const NO_STORE = { "cache-control": "private, no-store", ...ROBOTS };
const cacheHeaders = (urlPath: string, ext: string) =>
  ext === ".html" || ext === ".txt"
    ? NO_STORE
    : {
        "cache-control": urlPath.includes("/_next/static/")
          ? "private, max-age=31536000, immutable"
          : "private, max-age=300",
        ...ROBOTS,
      };

// A page load fires a request per file (JS, CSS, images). Resolving access
// takes DB queries, so the decision is cached per user for a short time;
// revoking someone takes effect within ACCESS_TTL_MS.
const ACCESS_TTL_MS = 30_000;
const accessCache = new Map<string, { allowed: boolean; userId: string; expires: number }>();

async function resolveAccess(email: string) {
  const hit = accessCache.get(email);
  if (hit && hit.expires > Date.now()) return hit;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      resourceAccess: {
        where: { resource: { resourceKey: PORTFOLIO_RESOURCE_KEY } },
        select: { id: true },
        take: 1,
      },
    },
  });
  const resource = user
    ? await prisma.resource.findFirst({
        where: { resourceKey: PORTFOLIO_RESOURCE_KEY, isActive: true },
        select: { id: true },
      })
    : null;
  const entry = {
    allowed:
      !!user &&
      !!resource &&
      (user.role === "super_admin" || user.resourceAccess.length > 0),
    userId: user?.id ?? "",
    expires: Date.now() + ACCESS_TTL_MS,
  };
  accessCache.set(email, entry);
  return entry;
}

const notFound = () =>
  new Response("Not found", { status: 404, headers: NO_STORE });

const redirect = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { location, ...NO_STORE },
  });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  // Only the signed session cookie is needed here, so skip getServerSession,
  // whose jwt callback re-reads the user from the DB on every call.
  const token = await getToken({ req });
  if (!token?.email) return redirect("/");

  // Unassigned users get a 404 rather than a 403 so the portfolio's existence
  // isn't confirmed to them.
  const access = await resolveAccess(token.email);
  if (!access.allowed) return notFound();

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
        internalUserId: access.userId,
        resourceKey: PORTFOLIO_RESOURCE_KEY,
        outcome: "success",
        details: { path: req.nextUrl.pathname },
      });
    }
    return new Response(file, {
      headers: {
        "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
        ...cacheHeaders(req.nextUrl.pathname, ext),
      },
    });
  } catch {
    return notFound();
  }
}
