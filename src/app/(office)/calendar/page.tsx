"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listDashboardJobs } from "@/lib/dashboard/provider";
import type { DashboardJob } from "@/lib/dashboard/types";

type CalendarMode = "week" | "month";

function toDateKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const [mode, setMode] = useState<CalendarMode>("week");
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listDashboardJobs();
        if (!active) return;
        setJobs(rows.filter((job) => Boolean(job.scheduled_at)));
      } catch (loadError) {
        if (!active) return;
        setError((loadError as Error)?.message ?? "Unable to load calendar.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const now = new Date();
    const horizonDays = mode === "week" ? 7 : 31;
    const end = new Date();
    end.setDate(now.getDate() + horizonDays);

    const map = new Map<string, DashboardJob[]>();
    jobs.forEach((job) => {
      if (!job.scheduled_at) return;
      const ms = new Date(job.scheduled_at).getTime();
      if (!Number.isFinite(ms)) return;
      if (ms < now.getTime() || ms > end.getTime()) return;
      const key = toDateKey(job.scheduled_at);
      if (!key) return;
      const existing = map.get(key) ?? [];
      existing.push(job);
      map.set(key, existing);
    });

    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [jobs, mode]);

  return (
    <section className="office-page">
      <div className="office-page-header">
        <h3>Calendar</h3>
        <p className="muted">Scheduled jobs by date.</p>
      </div>

      <div className="office-topbar-actions">
        <button
          className={`btn btn-secondary ${mode === "week" ? "office-active-btn" : ""}`}
          onClick={() => setMode("week")}
        >
          Week
        </button>
        <button
          className={`btn btn-secondary ${mode === "month" ? "office-active-btn" : ""}`}
          onClick={() => setMode("month")}
        >
          Month
        </button>
      </div>

      {loading ? <p className="muted">Loading calendar...</p> : null}
      {error ? <p className="dashboard-error">{error}</p> : null}

      {!loading ? (
        <div className="office-section-grid">
          {grouped.map(([dateKey, rows]) => (
            <article key={dateKey} className="card">
              <h4>{new Date(`${dateKey}T00:00:00`).toLocaleDateString()}</h4>
              <div className="office-list">
                {rows.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="office-list-row">
                    <strong>{job.title}</strong>
                    <small>{job.address}</small>
                    <small>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : "—"}</small>
                  </Link>
                ))}
              </div>
            </article>
          ))}
          {!grouped.length ? <p className="muted">No scheduled jobs in this {mode} view.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
