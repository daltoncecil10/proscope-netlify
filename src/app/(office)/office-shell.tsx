"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthGuard } from "@/lib/auth/use-auth-guard";
import {
  checkDashboardJobCreateSupport,
  createDashboardJob,
} from "@/lib/dashboard/provider";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/calendar", label: "Calendar" },
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Settings" },
] as const;

export function OfficeShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authLoading, user } = useAuthGuard();
  const [searchValue, setSearchValue] = useState("");
  const [canCreateJob, setCanCreateJob] = useState<boolean | null>(null);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createScheduledAt, setCreateScheduledAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const title = useMemo(() => {
    if (pathname.startsWith("/jobs/")) return "Job Workspace";
    const match = NAV_ITEMS.find((item) => pathname === item.href);
    return match?.label ?? "ProScope Office";
  }, [pathname]);

  const handleGlobalSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchValue.trim();
    if (!query) {
      router.push("/jobs");
      return;
    }
    router.push(`/jobs?q=${encodeURIComponent(query)}`);
  };

  useEffect(() => {
    let active = true;
    void checkDashboardJobCreateSupport()
      .then((supported) => {
        if (!active) return;
        setCanCreateJob(supported);
      })
      .catch(() => {
        if (!active) return;
        setCanCreateJob(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const resetCreateForm = () => {
    setCreateName("");
    setCreateAddress("");
    setCreateNotes("");
    setCreateScheduledAt("");
    setCreateError(null);
  };

  const handleCreateJob = async (event: FormEvent) => {
    event.preventDefault();
    if (!createName.trim() || !createAddress.trim()) {
      setCreateError("Name and address are required.");
      return;
    }
    setCreatingJob(true);
    setCreateError(null);
    try {
      const scheduledAt = createScheduledAt.trim()
        ? (() => {
            const parsed = new Date(createScheduledAt);
            if (!Number.isFinite(parsed.getTime())) {
              throw new Error("invalid-date");
            }
            return parsed.toISOString();
          })()
        : null;
      const created = await createDashboardJob({
        title: createName,
        address: createAddress,
        notes: createNotes,
        scheduledAt,
      });
      setShowCreateJob(false);
      resetCreateForm();
      setToastMessage("Job created.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("proscope:job-created", { detail: { id: created.id } }));
      }
      router.push(`/jobs/${encodeURIComponent(created.id)}`);
    } catch (error) {
      if ((error as Error)?.message === "invalid-date") {
        setCreateError("Please enter a valid scheduled date.");
      } else {
        const message = (error as Error)?.message ?? "New Job is unavailable right now.";
        setCreateError(message);
      }
    } finally {
      setCreatingJob(false);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="page">
        <section className="dashboard-auth-wrap">
          <div className="dashboard-auth-card">
            <p className="muted">Loading ProScope Office...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="office-shell">
      <aside className="office-sidebar">
        <div>
          <p className="eyebrow">ProScope</p>
          <h1 className="office-sidebar-title">Office</h1>
          <Link href="/" className="muted office-home-link">
            Back to Home
          </Link>
        </div>
        <nav className="office-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`office-nav-item ${
                pathname === item.href || pathname.startsWith(`${item.href}/`) ? "active" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="office-main">
        <header className="office-topbar">
          <div>
            <p className="muted">ProScope Office</p>
            <h2>{title}</h2>
          </div>
          <div className="office-topbar-actions">
            <form onSubmit={handleGlobalSearch} className="office-search-form">
              <input
                className="input office-search-input"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search jobs..."
              />
              <button className="btn btn-secondary" type="submit">
                Search
              </button>
            </form>
            <div className="office-account">
              {canCreateJob ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    resetCreateForm();
                    setShowCreateJob(true);
                  }}
                >
                  New Job
                </button>
              ) : null}
              <span className="muted">{user.email ?? "ProScope user"}</span>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  void supabase.auth.signOut().then(() => router.replace("/login"));
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>
        <div className="office-content">{children}</div>
      </section>

      {showCreateJob ? (
        <div className="lightbox-overlay" onClick={() => setShowCreateJob(false)}>
          <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
            <div className="dashboard-panel">
              <h3>Create New Job</h3>
              <p className="muted">Add a job for office scheduling and mobile field workflows.</p>
              <form onSubmit={handleCreateJob} className="dashboard-job-editor">
                <input
                  className="input"
                  placeholder="Name / Customer"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  required
                />
                <input
                  className="input"
                  placeholder="Address"
                  value={createAddress}
                  onChange={(event) => setCreateAddress(event.target.value)}
                  required
                />
                <textarea
                  className="input dashboard-notes-input"
                  placeholder="Notes (optional)"
                  value={createNotes}
                  onChange={(event) => setCreateNotes(event.target.value)}
                />
                <input
                  className="input"
                  type="datetime-local"
                  value={createScheduledAt}
                  onChange={(event) => setCreateScheduledAt(event.target.value)}
                />
                {createError ? <p className="dashboard-error">{createError}</p> : null}
                <div className="office-topbar-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateJob(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={creatingJob}>
                    {creatingJob ? "Creating..." : "Create Job"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? <div className="office-toast">{toastMessage}</div> : null}
    </main>
  );
}
