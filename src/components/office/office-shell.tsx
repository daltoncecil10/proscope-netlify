"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./office.module.css";

export type OfficeNavId =
  | "dashboard"
  | "jobs"
  | "calendar"
  | "team"
  | "settings";

type SessionUser = { id: string; email: string | null };

type OfficeShellProps = {
  activeNav: OfficeNavId;
  crumbs: ReactNode;
  children: ReactNode;
  user: SessionUser | null;
  jobCount?: number;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  topbarEnd?: ReactNode;
  variant?: "default" | "job";
  jobBackHref?: string;
};

const NAV: { id: OfficeNavId; label: string; href: string; group: "workspace" | "team" }[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", group: "workspace" },
  { id: "jobs", label: "Jobs", href: "/jobs", group: "workspace" },
  { id: "calendar", label: "Calendar", href: "/calendar", group: "workspace" },
  { id: "team", label: "Team", href: "/team", group: "workspace" },
  { id: "settings", label: "Settings", href: "/settings", group: "team" },
];

export function OfficeShell({
  activeNav,
  crumbs,
  children,
  user,
  jobCount = 0,
  search,
  topbarEnd,
  variant = "default",
  jobBackHref = "/jobs",
}: OfficeShellProps) {
  const email = user?.email ?? null;
  const userInitials = email ? email.slice(0, 2).toUpperCase() : "DC";
  const workspaceNav = NAV.filter((n) => n.group === "workspace");
  const teamNav = NAV.filter((n) => n.group === "team");

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.brand}>
          <div className={styles.brandMark} aria-hidden />
          <div>
            <div className={styles.brandName}>ProScope</div>
            <div className={styles.brandSub}>Office</div>
          </div>
        </Link>

        <nav className={styles.navGroup}>
          <div className={styles.navLabel}>Workspace</div>
          {workspaceNav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.navItem} ${activeNav === item.id ? styles.navItemActive : ""}`}
            >
              {item.label}
              {item.id === "jobs" && jobCount > 0 ? (
                <span className={styles.navCount}>{jobCount}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <nav className={styles.navGroup}>
          <div className={styles.navLabel}>Team</div>
          {teamNav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.navItem} ${activeNav === item.id ? styles.navItemActive : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.avatar}>{userInitials}</div>
          <div className={styles.footerId}>
            <div className={styles.footerName}>{email?.split("@")[0] ?? "User"}</div>
            <div className={styles.footerEmail}>{email ?? ""}</div>
          </div>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          {variant === "job" ? (
            <Link href={jobBackHref} className={styles.backLink}>
              ← Back to Jobs
            </Link>
          ) : (
            <div className={styles.crumbs}>{crumbs}</div>
          )}
          {search && variant === "default" ? (
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon} aria-hidden>
                ⌕
              </span>
              <input
                className={styles.searchInput}
                placeholder={search.placeholder ?? "Search jobs and addresses…"}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
              />
              <span className={styles.searchKbd}>⌘K</span>
            </div>
          ) : null}
          <div className={styles.topbarSpacer} />
          {topbarEnd}
        </header>
        {children}
      </div>
    </div>
  );
}
