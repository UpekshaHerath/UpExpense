import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth (Google) redirect target. Supabase sends the user here with a `code`
// after they authorize; we exchange it for a session cookie, then forward on.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Forward to the client interstitial, which shows the branded loader
      // and then navigates to `next` — so the user sees the loading screen
      // right after picking their Google account.
      const dest = `/auth/redirecting?next=${encodeURIComponent(next)}`;
      // Behind a proxy/load balancer the real host is in x-forwarded-host.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (isLocal || !forwardedHost) {
        return NextResponse.redirect(`${origin}${dest}`);
      }
      return NextResponse.redirect(`https://${forwardedHost}${dest}`);
    }
  }

  // No code, or exchange failed — bounce back to login with a flag.
  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
