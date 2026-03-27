"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listDashboardJobs } from "@/lib/dashboard/provider";
import type { DashboardJob } from "@/lib/dashboard/types";
import { listOwnerSharePackages } from "@/lib/share/provider";
import type { OwnerSharePackage } from "@/lib/share/types";

function isActiveStatus(status: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized !== "completed" && normalized !== "closed" && normalized !== "archived";
}

export default function DashboardHomePage() {
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [shareLinks, setShareLinks] = useState<OwnerSharePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [nextJobs, nextShareLinks] = await Promise.all([
          listDashboardJobs(),
          listOwnerSharePackages(),
        ]);
        if (!active) return;
        setJobs(nextJobs);
        setShareLinks(nextShareLinks);
      } catch (loadError) {
        if (!active) return;
        setError((loadError as Error)?.message ?? "Unable to load dashboard summary.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const activeJobs = useMemo(() => jobs.filter((job) => isActiveStatus(job.status)), [jobs]);
  const recentJobs = useMemo(() => jobs.slice(0, 6), [jobs]);
  const thisWeekInspections = useMemo(() => {
    const now = new Date();
    const end = new Date();
    end.setDate(now.getDate() + 7);
    return jobs.filter((job) => {
      if (!job.scheduled_at) return false;
      const when = new Date(job.scheduled_at).getTime();
      return Number.isFinite(when) && when >= now.getTime() && when <= end.getTime();
    });
  }, [jobs]);
  const recentShareLinks = useMemo(() => shareLinks.slice(0, 6), [shareLinks]);

  return (
    <section className="office-page">
      <div className="office-page-header">
        <h3>What needs attention</h3>
        <p className="muted">Office-first summary from live jobs and sharing activity.</p>
      </div>

      {error ? <p className="dashboard-error">{error}</p> : null}
      {loading ? <p className="muted">Loading summary...</p> : null}

      {!loading ? (
        <>
          <div className="office-kpi-grid">
            <article className="card">
              <h4>Active Jobs</h4>
              <p className="office-kpi-value">{activeJobs.length}</p>
            </article>
            <article className="card">
              <h4>Inspections This Week</h4>
              <p className="office-kpi-value">{thisWeekInspections.length}</p>
            </article>
            <article className="card">
              <h4>Recent Share Links</h4>
              <p className="office-kpi-value">{shareLinks.length}</p>
            </article>
          </div>

          <div className="office-section-grid">
            <article className="card">
              <h4>Recent Jobs</h4>
              <div className="office-list">
                {recentJobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="office-list-row">
                    <strong>{job.title}</strong>
                    <span>{job.address}</span>
                    <small>
                      {(job.status ?? "scheduled").toLowerCase()} •{" "}
                      {job.updated_at ? new Date(job.updated_at).toLocaleString() : "No update"}
                    </small>
                  </Link>
                ))}
                {!recentJobs.length ? <p className="muted">No jobs yet.</p> : null}
              </div>
            </article>

            <article className="card">
              <h4>Recent Share Activity</h4>
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
                  <p className="muted">No share links created yet.</p>
                ) : null}
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
