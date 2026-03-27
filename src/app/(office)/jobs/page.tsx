"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { listDashboardJobs } from "@/lib/dashboard/provider";
import type { DashboardJob } from "@/lib/dashboard/types";

type SortKey = "updated_at" | "scheduled_at" | "title";

export default function JobsPage() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const [scheduledOnly, setScheduledOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextJobs = await listDashboardJobs();
        if (!active) return;
        setJobs(nextJobs);
      } catch (loadError) {
        if (!active) return;
        setError((loadError as Error)?.message ?? "Unable to load jobs.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const statusOptions = useMemo(() => {
    return [...new Set(jobs.map((job) => (job.status ?? "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = jobs.filter((job) => {
      const text = [job.title, job.address, job.status ?? "", job.notes ?? ""]
        .join(" ")
        .toLowerCase();
      if (normalizedQuery && !text.includes(normalizedQuery)) return false;
      if (statusFilter && (job.status ?? "") !== statusFilter) return false;
      if (scheduledOnly && !job.scheduled_at) return false;
      return true;
    });

    rows.sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title);
      const av = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0;
      const bv = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0;
      return bv - av;
    });

    return rows;
  }, [jobs, query, scheduledOnly, sortKey, statusFilter]);

  return (
    <section className="office-page">
      <div className="office-page-header">
        <h3>Jobs</h3>
        <p className="muted">Search, filter, and open jobs for office review.</p>
      </div>

      <div className="office-filter-bar">
        <input
          className="input"
          placeholder="Search title, address, status, notes..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="input"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
        >
          <option value="updated_at">Sort: Last updated</option>
          <option value="scheduled_at">Sort: Scheduled date</option>
          <option value="title">Sort: Title</option>
        </select>
        <label className="office-inline-checkbox">
          <input
            type="checkbox"
            checked={scheduledOnly}
            onChange={(event) => setScheduledOnly(event.target.checked)}
          />
          <span>Scheduled only</span>
        </label>
      </div>

      {loading ? <p className="muted">Loading jobs...</p> : null}
      {error ? <p className="dashboard-error">{error}</p> : null}

      {!loading ? (
        <div className="office-table-wrap">
          <table className="office-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Address</th>
                <th>Status</th>
                <th>Scheduled</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <strong>{job.title}</strong>
                  </td>
                  <td>{job.address}</td>
                  <td>{job.status ?? "scheduled"}</td>
                  <td>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : "—"}</td>
                  <td>{job.updated_at ? new Date(job.updated_at).toLocaleString() : "—"}</td>
                  <td>
                    <Link className="btn btn-secondary office-inline-btn" href={`/jobs/${job.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredJobs.length ? <p className="muted">No jobs match current filters.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
