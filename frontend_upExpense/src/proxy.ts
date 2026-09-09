import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16: "Proxy" is the new name for Middleware.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // All paths except static assets, images, the public metadata image
    // routes (OG/Twitter), PWA assets (manifest, service worker, offline
    // page), and the cron endpoints — browsers and pg_cron fetch those
    // unauthenticated, so they must skip the auth redirect. /api/cron carries
    // its own shared-secret check.
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|twitter-image|manifest.webmanifest|sw.js|offline.html|apple-icon|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
