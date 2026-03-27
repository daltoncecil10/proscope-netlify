"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthGuard } from "@/lib/auth/use-auth-guard";

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
    </main>
  );
}
