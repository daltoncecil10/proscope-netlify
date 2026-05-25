"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase, SUPABASE_SETUP_MESSAGE } from "@/lib/supabase/client";

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (data.session?.user) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  if (!isSupabaseConfigured) {
    return (
      <main className="page">
        <section className="dashboard-auth-wrap">
          <div className="dashboard-auth-card">
            <p className="eyebrow">ProScope Office</p>
            <h1>Configuration required</h1>
            <p className="muted">{SUPABASE_SETUP_MESSAGE}</p>
          </div>
        </section>
      </main>
    );
  }

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
      router.replace("/dashboard");
    } catch (err) {
      const message = (err as Error)?.message ?? "Unable to sign in.";
      setError(
        message.includes("Invalid API key")
          ? "Invalid Supabase anon key. In .env.local use the anon public key from Supabase → Project Settings → API, then restart npm run dev."
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="dashboard-auth-wrap">
        <div className="dashboard-auth-card">
          <p className="eyebrow">ProScope Office</p>
          <h1>Sign In</h1>
          <p className="muted">Use the same login as the mobile app.</p>
          <form onSubmit={handleSignIn} className="dashboard-auth-form">
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
            {error ? <p className="dashboard-error">{error}</p> : null}
          </form>
        </div>
      </section>
    </main>
  );
}

