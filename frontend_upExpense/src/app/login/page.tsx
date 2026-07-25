"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  AuthDivider,
  AuthField,
  AuthShell,
  PasswordInput,
} from "@/components/auth";
import { BrandLoader } from "@/components/brand-loader";
import { GoogleButton } from "@/components/google-button";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Surface a failed Google round-trip (/auth/callback → ?error=oauth).
  // Derived from the URL during render — `useSearchParams` is SSR-safe, so
  // server and client agree (no hydration mismatch, no setState-in-effect).
  // A password-submit error takes precedence once one is set.
  const shownError =
    error ??
    (searchParams.get("error") === "oauth"
      ? "Google sign-in failed. Please try again."
      : null);
  const [loading, setLoading] = useState(false);
  // Stays true through the redirect so the branded loader covers the whole
  // login → app transition (this component only unmounts once the app route
  // renders).
  const [redirecting, setRedirecting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message
      );
      setLoading(false);
      return;
    }

    // Hold the branded loader for a beat so it always plays, then navigate.
    setRedirecting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    router.push("/");
    router.refresh();
  }

  if (redirecting) {
    return <BrandLoader label="Loading your expenses…" />;
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to keep tracking your expenses."
    >
      <GoogleButton next="/" />
      <AuthDivider label="or continue with email" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="email"
          label="Email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {shownError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {shownError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-10 w-full"
        >
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

// `useSearchParams` (used in LoginForm to surface the OAuth error) requires a
// Suspense boundary — without it the page would be forced to client-only
// rendering.
export default function LoginPage() {
  return (
    <Suspense fallback={<BrandLoader label="Loading…" />}>
      <LoginForm />
    </Suspense>
  );
}
