"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthField, AuthShell, PasswordInput } from "@/components/auth";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setError(
        "Username must be 3–30 characters: letters, numbers, underscores."
      );
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is enabled in Supabase, there is no session yet.
    if (!data.session) {
      setAwaitingConfirm(true);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (awaitingConfirm) {
    return (
      <AuthShell title="Check your email" subtitle="">
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong>{email}</strong>. Click it,
          then{" "}
          <Link href="/login" className="text-primary hover:underline">
            log in
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Track daily expenses. Understand your year."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="username"
          label="Username"
          type="text"
          required
          autoFocus
          autoComplete="username"
          placeholder="jane_doe"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <AuthField
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="Minimum 8 characters"
        />

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-10 w-full"
        >
          {loading ? "Creating account…" : "Sign up"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
