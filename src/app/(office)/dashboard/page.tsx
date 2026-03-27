"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listDashboardJobs } from "@/lib/dashboard/provider";
import type { DashboardJob } from "@/lib/dashboard/types";
import { getDashboardReportActions, listOwnerSharePackages } from "@/lib/share/provider";
import type { OwnerSharePackage } from "@/lib/share/types";

function isActiveStatus(status: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized !== "completed" && normalized !== "closed" && normalized !== "archived";
}

function shortDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not scheduled";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cityStateFromAddress(address: string | null | undefined) {
  const value = (address ?? "").trim();
  if (!value) return "Location not set";
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  return value;
}

export default function DashboardHomePage() {
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [shareLinks, setShareLinks] = useState<OwnerSharePackage[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(true);
  const [jobsUnavailable, setJobsUnavailable] = useState(false);
  const [shareUnavailable, setShareUnavailable] = useState(false);
  const [reportReadyCount, setReportReadyCount] = useState<number | null>(null);
  const [reportsUnavailable, setReportsUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setJobsLoading(true);
      setShareLoading(true);
      setJobsUnavailable(false);
      setShareUnavailable(false);

      const [jobsResult, sharesResult] = await Promise.allSettled([
        listDashboardJobs(),
        listOwnerSharePackages(),
      ]);

      if (!active) return;

      if (jobsResult.status === "fulfilled") {
        setJobs(jobsResult.value);
      } else {
        setJobs([]);
        setJobsUnavailable(true);
      }

      if (sharesResult.status === "fulfilled") {
        setShareLinks(sharesResult.value);
      } else {
        setShareLinks([]);
        setShareUnavailable(true);
      }

      setJobsLoading(false);
      setShareLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadReportAvailability = async () => {
      if (!jobs.length) {
        setReportReadyCount(0);
        setReportsUnavailable(false);
        return;
      }

      const targetJobs = jobs.filter((job) => isActiveStatus(job.status)).slice(0, 40);
      if (!targetJobs.length) {
        setReportReadyCount(0);
        setReportsUnavailable(false);
        return;
      }

      const checks = await Promise.allSettled(
        targetJobs.map(async (job) => {
          const actions = await getDashboardReportActions(job.id);
          return Boolean(actions.reportUrl);
        })
      );

      if (!active) return;

      const successful = checks.filter((check) => check.status === "fulfilled");
      if (!successful.length) {
        setReportsUnavailable(true);
        setReportReadyCount(null);
        return;
      }

      setReportsUnavailable(false);
      setReportReadyCount(
        successful.filter((check) => check.status === "fulfilled" && check.value).length
      );
    };

    void loadReportAvailability();
    return () => {
      active = false;
    };
  }, [jobs]);

  const activeJobs = useMemo(() => jobs.filter((job) => isActiveStatus(job.status)), [jobs]);
  const recentJobs = useMemo(() => jobs.slice(0, 6), [jobs]);
  const recentShareLinks = useMemo(() => shareLinks.slice(0, 8), [shareLinks]);
  const jobsScheduledToday = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return jobs.filter((job) => {
      if (!job.scheduled_at) return false;
      const when = new Date(job.scheduled_at).getTime();
      return Number.isFinite(when) && when >= start.getTime() && when <= end.getTime();
    }).length;
  }, [jobs]);

  const needsAttentionItems = useMemo(() => {
    const items: { key: string; label: string; count: number; href?: string }[] = [];
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);

    const overdue = jobs.filter((job) => {
      if (!job.scheduled_at) return false;
      const when = new Date(job.scheduled_at).getTime();
      if (!Number.isFinite(when)) return false;
      const status = (job.status ?? "").trim().toLowerCase();
      return when < startToday.getTime() && status !== "completed" && status !== "cancelled";
    }).length;
    if (overdue) {
      items.push({
        key: "overdue",
        label: "Past Due Jobs",
        count: overdue,
        href: "/jobs?filter=past_due",
      });
    }

    const failed = jobs.filter((job) =>
      ["failed", "error", "issue"].some((needle) =>
        (job.status ?? "").toLowerCase().includes(needle)
      )
    ).length;
    if (failed) {
      items.push({
        key: "failed",
        label: "Issue Jobs",
        count: failed,
        href: "/jobs?filter=issues",
      });
    }

    const pendingReview = jobs.filter((job) =>
      ["review", "pending"].some((needle) =>
        (job.status ?? "").toLowerCase().includes(needle)
      )
    ).length;
    if (pendingReview) {
      items.push({
        key: "pending",
        label: "Pending Review",
        count: pendingReview,
        href: "/jobs?filter=pending_review",
      });
    }

    if (!reportsUnavailable && reportReadyCount !== null) {
      const missingReports = Math.max(activeJobs.length - reportReadyCount, 0);
      if (missingReports) {
        items.push({
          key: "missing-reports",
          label: "Missing Reports",
          count: missingReports,
          // Missing report filter is not cleanly supported in /jobs yet.
        });
      }
    }

    return items;
  }, [jobs, activeJobs.length, reportReadyCount, reportsUnavailable]);

  const loading = jobsLoading || shareLoading;

  return (
    <section className="office-page dashboard-page">
      <div className="office-page-header">
        <h3>Dashboard</h3>
        <p className="muted">Prioritized office view for jobs, reports, and sharing activity.</p>
      </div>

      {loading ? <p className="muted">Loading dashboard...</p> : null}

      {!loading ? (
        <>
          <div className="dashboard-summary-row">
            <article className="card">
              <h4>Active Jobs</h4>
              <p className="office-kpi-value">{activeJobs.length}</p>
            </article>
            <article className="card">
              <h4>Reports Ready</h4>
              {reportsUnavailable ? (
                <p className="office-kpi-value">Syncing</p>
              ) : (
                <p className="office-kpi-value">{reportReadyCount ?? 0}</p>
              )}
            </article>
            <article className="card">
              <h4>Jobs Scheduled Today</h4>
              <p className="office-kpi-value">{jobsScheduledToday}</p>
            </article>
          </div>

          <div className="dashboard-secondary-row">
            <article className="card">
              <h4>Needs Attention</h4>
              <div className="office-list">
                {needsAttentionItems.map((item) => (
                  item.href ? (
                    <Link key={item.key} href={item.href} className="office-list-row needs-attention-row">
                      <strong>{item.count} {item.label}</strong>
                    </Link>
                  ) : (
                    <div key={item.key} className="office-list-row needs-attention-row">
                      <strong>{item.count} {item.label}</strong>
                    </div>
                  )
                ))}
                {!needsAttentionItems.length ? (
                  <p className="muted">No urgent issues found. You are caught up for now.</p>
                ) : null}
                {jobsUnavailable ? (
                  <p className="muted">Job activity unavailable right now.</p>
                ) : null}
              </div>
            </article>

            <article className="card">
              <h4>Recent Jobs</h4>
              <div className="office-list">
                {recentJobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="office-list-row">
                    <strong>{job.title}</strong>
                    <span className="muted">{cityStateFromAddress(job.address)}</span>
                    <small>{shortDateTime(job.scheduled_at)}</small>
                  </Link>
                ))}
                {!recentJobs.length && !jobsUnavailable ? (
                  <p className="muted">No jobs yet. Add a job in the app to get started.</p>
                ) : null}
                {jobsUnavailable ? (
                  <p className="muted">Recent jobs unavailable right now.</p>
                ) : null}
              </div>
            </article>
          </div>

          {(!shareUnavailable || recentShareLinks.length > 0) ? (
            <article className="card">
              <h4>Recent Share Links</h4>
              <div className="office-list">
                {recentShareLinks.map((link) => (
                  <a
                    key={link.token}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="office-list-row"
                  >
                    <strong>{link.title}</strong>
                    <small>
                      Expires {new Date(link.expiresAt).toLocaleDateString()} •{" "}
                      {link.isRevoked ? "Revoked" : "Active"}
                    </small>
                  </a>
                ))}
                {!recentShareLinks.length ? (
                  <p className="muted">No share links yet. Create one from a job in one click.</p>
                ) : null}
              </div>
            </article>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
