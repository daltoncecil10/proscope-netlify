"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const remembered = window.localStorage.getItem("proscope-remember-login-email");
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

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
      if (rememberMe) {
        window.localStorage.setItem("proscope-remember-login-email", email.trim().toLowerCase());
      } else {
        window.localStorage.removeItem("proscope-remember-login-email");
      }
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error)?.message ?? "Unable to sign in.");
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
            <label className="office-inline-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span className="muted">Remember me on this device</span>
            </label>
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
