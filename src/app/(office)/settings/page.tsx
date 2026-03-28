"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthGuard } from "@/lib/auth/use-auth-guard";
import { supabase } from "@/lib/supabase/client";

type ThemeMode = "system" | "dark" | "light";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  if (mode === "dark") root.style.colorScheme = "dark";
  if (mode === "light") root.style.colorScheme = "light";
  if (mode === "system") root.style.colorScheme = "";
}

export default function SettingsPage() {
  const { authLoading, user } = useAuthGuard();
  const [role, setRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("proscope-theme-mode");
    if (saved === "system" || saved === "dark" || saved === "light") {
      setThemeMode(saved);
      applyTheme(saved);
      return;
    }
    applyTheme("system");
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    void supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user;
      if (!sessionUser) return;
      const maybeRole =
        (sessionUser.app_metadata?.role as string | undefined) ??
        (sessionUser.user_metadata?.role as string | undefined) ??
        null;
      const maybeStatus =
        (sessionUser.user_metadata?.status as string | undefined) ??
        (sessionUser.app_metadata?.status as string | undefined) ??
        null;
      setRole(maybeRole && maybeRole.trim() ? maybeRole : null);
      setStatus(maybeStatus && maybeStatus.trim() ? maybeStatus : null);
    });
  }, [authLoading, user]);

  useEffect(() => {
    window.localStorage.setItem("proscope-theme-mode", themeMode);
    applyTheme(themeMode);
  }, [themeMode]);

  const normalizedRole = useMemo(() => {
    if (!role) return null;
    return role
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
      .join(" ");
  }, [role]);

  const normalizedStatus = useMemo(() => {
    if (!status) return null;
    return status
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
      .join(" ");
  }, [status]);

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    setResetMessage(null);
    setResetError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setResetMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      setResetError((error as Error)?.message ?? "Unable to send reset email.");
    } finally {
      setResetLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <section className="office-page">
        <p className="muted">Loading settings...</p>
      </section>
    );
  }

  return (
    <section className="office-page settings-page">
      <div className="office-page-header">
        <h3>Settings</h3>
        <p className="muted">Manage account security and appearance preferences.</p>
      </div>

      <article className="card settings-section">
        <h4>Account</h4>
        <dl className="job-meta-list">
          <div className="job-meta-row">
            <dt>Email</dt>
            <dd>{user.email ?? "Unknown"}</dd>
          </div>
          {normalizedRole ? (
            <div className="job-meta-row">
              <dt>Role</dt>
              <dd>{normalizedRole}</dd>
            </div>
          ) : null}
          {normalizedStatus ? (
            <div className="job-meta-row">
              <dt>Status</dt>
              <dd>{normalizedStatus}</dd>
            </div>
          ) : null}
        </dl>
      </article>

      <article className="card settings-section">
        <h4>Password</h4>
        <p className="muted">Send a secure password reset email for your account.</p>
        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleResetPassword()}
            disabled={resetLoading}
          >
            {resetLoading ? "Sending..." : "Reset Password"}
          </button>
        </div>
        {resetMessage ? <p className="settings-success">{resetMessage}</p> : null}
        {resetError ? <p className="dashboard-error">{resetError}</p> : null}
      </article>

      <article className="card settings-section">
        <h4>Appearance</h4>
        <p className="muted">Choose how ProScope looks on this device.</p>
        <div className="settings-theme-options" role="radiogroup" aria-label="Theme mode">
          {(["system", "dark", "light"] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn btn-secondary settings-theme-btn ${
                themeMode === mode ? "settings-theme-btn-active" : ""
              }`}
              onClick={() => setThemeMode(mode)}
              role="radio"
              aria-checked={themeMode === mode}
            >
              {mode[0].toUpperCase()}
              {mode.slice(1)}
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}
