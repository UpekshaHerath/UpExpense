"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandLoader } from "@/components/brand-loader";

/**
 * Post-OAuth interstitial. `/auth/callback` (a server route) exchanges the
 * code then redirects here. This page renders the branded loader on first
 * paint — the first thing the user sees after picking a Google account — and
 * then client-navigates into the app. The loader stays on screen through that
 * navigation (no `loading.tsx` needed) until the destination is ready, so the
 * Google flow gets the same branded transition as email/password sign-in.
 */
export default function AuthRedirecting() {
  const router = useRouter();

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    // Guard against an open-redirect via the `next` param — only same-origin
    // in-app paths are allowed.
    const dest = next.startsWith("/") ? next : "/";
    // Hold the branded loader for a beat so it always plays in full — matches
    // the email/password flow's deliberate 1.5s hold before navigating.
    const timer = setTimeout(() => router.replace(dest), 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return <BrandLoader label="Loading your expenses…" />;
}
