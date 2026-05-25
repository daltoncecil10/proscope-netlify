"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OfficeShell } from "@/components/office/office-shell";
import styles from "@/components/office/office.module.css";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";
import { listDashboardJobs } from "@/lib/dashboard/provider";
import type { DashboardFilter, DashboardJob } from "@/lib/dashboard/types";
import {
  expiresUrgency,
  filterJob,
  formatExpiresLabel,
  formatInspected,
  statusClassName,
  statusLabel,
} from "@/lib/dashboard/utils";
function ExpiresCell({ job }: { job: DashboardJob }) {
  const urgency = expiresUrgency(job.expiresAt);
  const label = formatExpiresLabel(job.expiresAt);
  const className =
    urgency === "urgent"
      ? styles.expiresUrgent
      : urgency === "warn"
        ? styles.expiresWarn
        : styles.expiresNormal;
  return <span className={className}>{label}</span>;
}

export function JobsClient() {
  const { user } = useOfficeAuth();
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const refreshJobs = useCallback(async (userId: string) => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      setJobs(await listDashboardJobs(userId));
    } catch (err) {
      setJobsError((err as Error)?.message ?? "Failed to load jobs");
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void refreshJobs(user.id);
  }, [user?.id, refreshJobs]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (!filterJob(job, filter)) return false;
      if (!q) return true;
      return (
        job.title.toLowerCase().includes(q) ||
        job.address.toLowerCase().includes(q)
      );
    });
  }, [jobs, filter, search]);

  const counts = useMemo(() => {
    const c = {
      all: jobs.length,
      ready: 0,
      in_progress: 0,
      drafts: 0,
      scheduled: 0,
      expiring_soon: 0,
    };
    for (const j of jobs) {
      if (j.status === "ready") c.ready += 1;
      if (j.status === "in_progress") c.in_progress += 1;
      if (j.status === "draft") c.drafts += 1;
      if (j.status === "scheduled") c.scheduled += 1;
      if (filterJob(j, "expiring_soon")) c.expiring_soon += 1;
    }
    return c;
  }, [jobs]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <OfficeShell
      activeNav="jobs"
      user={user}
      jobCount={counts.all}
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search title, address, or ZIP…",
      }}
      crumbs={
        <>
          <span>ProScope Office</span>
          <span className={styles.crumbsHere}>/ Jobs</span>
        </>
      }
      topbarEnd={
        <button type="button" className={styles.btnPrimary}>
          + New job
        </button>
      }
    >
      <div className={styles.content}>
        <h1 className={styles.pageH1}>Jobs</h1>
        <p className={styles.pageMeta}>
          {counts.all} jobs · find, filter, and download inspection packages.
        </p>

        <div className={styles.focus}>
          <div className={`${styles.focusCell} ${styles.focusCellLead}`}>
            <div className={styles.focusLabel}>Ready to send</div>
            <div className={styles.focusValue}>{counts.ready}</div>
            <div className={styles.focusFoot}>
              <Link href="/jobs">View ready →</Link>
            </div>
          </div>
          <div className={styles.focusCell}>
            <div className={styles.focusLabel}>In progress</div>
            <div className={styles.focusValue}>{counts.in_progress}</div>
            <div className={styles.focusFoot}>Active inspections</div>
          </div>
          <div className={styles.focusCell}>
            <div className={styles.focusLabel}>Expiring ≤7d</div>
            <div className={styles.focusValue}>{counts.expiring_soon}</div>
            <div className={styles.focusFoot}>Auto-delete window</div>
          </div>
          <div className={styles.focusCell}>
            <div className={styles.focusLabel}>All jobs</div>
            <div className={styles.focusValue}>{counts.all}</div>
            <div className={styles.focusFoot}>{filteredJobs.length} shown</div>
          </div>
        </div>

        <section className={styles.jobsCard}>
          <div className={styles.jobsCardHead}>
            <div className={styles.jobsTitle}>
              All jobs <span className={styles.countPill}>{counts.all}</span>
            </div>
            <div className={styles.chips}>
              {(
                [
                  ["all", "All", counts.all],
                  ["ready", "Ready", counts.ready],
                  ["in_progress", "In progress", counts.in_progress],
                  ["drafts", "Drafts", counts.drafts],
                  ["scheduled", "Scheduled", counts.scheduled],
                  ["expiring_soon", "Expiring soon", counts.expiring_soon],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.chip} ${filter === key ? styles.chipActive : ""}`}
                  onClick={() => setFilter(key)}
                >
                  {label} {count}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.chip} ${styles.chipTrash} ${filter === "trash" ? styles.chipActive : ""}`}
                onClick={() => setFilter("trash")}
                title="Trash is coming soon"
              >
                Trash
              </button>
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <div className={styles.bulkBar}>
              <span>{selectedIds.size} selected</span>
              <div className={styles.bulkActions}>
                <button type="button" className={styles.btnSecondary}>
                  Download as .zip
                </button>
                <button type="button" className={styles.btnSecondary}>
                  Share via link
                </button>
                <button type="button" className={styles.btnSecondary}>
                  Move to trash
                </button>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          {filter === "trash" ? (
            <p className={styles.loading} style={{ padding: 24 }}>
              Trash bucket (7-day retention) is not wired to the database yet. Deleted jobs
              will appear here in a future release.
            </p>
          ) : null}

          {jobsError ? (
            <p className={styles.error}>{jobsError}</p>
          ) : jobsLoading ? (
            <p className={styles.loading}>Loading jobs…</p>
          ) : filter === "trash" ? null : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th>Job</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th>Client</th>
                    <th style={{ width: 90 }}>Photos</th>
                    <th style={{ width: 130 }}>Captured</th>
                    <th style={{ width: 90 }}>Expires</th>
                    <th style={{ width: 130 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => {
                    const inspected = formatInspected(job.inspectedAt);
                    return (
                      <tr key={job.id}>
                        <td>
                          <input
                            type="checkbox"
                            className={styles.check}
                            checked={selectedIds.has(job.id)}
                            onChange={() => toggleSelect(job.id)}
                          />
                        </td>
                        <td>
                          <Link href={`/jobs/${job.id}`} className={styles.jobRowLink}>
                            <div className={styles.jobCellTitle}>{job.title}</div>
                            <div className={styles.jobCellAddr}>{job.address}</div>
                          </Link>
                        </td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${statusClassName(job.status, styles)}`}
                          >
                            <span className={styles.statusDot} />
                            {statusLabel(job)}
                          </span>
                        </td>
                        <td>
                          <div className={styles.inspectorCell}>
                            <span
                              className={styles.inspectorAvatar}
                              style={{ background: job.inspectorColor }}
                            >
                              {job.inspectorInitials}
                            </span>
                            {job.assigneeName}
                          </div>
                        </td>
                        <td>
                          <span className={styles.photoCountCell}>
                            <span aria-hidden>📷</span>
                            {job.photoCount}
                          </span>
                        </td>
                        <td>
                          <div className={styles.mono}>{inspected.date}</div>
                          <div className={styles.monoMute}>{inspected.time}</div>
                        </td>
                        <td>
                          <ExpiresCell job={job} />
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            <Link
                              href={`/jobs/${job.id}`}
                              className={styles.rowActionBtn}
                              title="Open job"
                            >
                              ↗
                            </Link>
                            <button
                              type="button"
                              className={styles.rowActionBtn}
                              title="More"
                            >
                              ⋯
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filter !== "trash" ? (
            <div className={styles.tableFoot}>
              <span>
                Showing {filteredJobs.length} of {jobs.length} jobs
              </span>
              <Link href="/dashboard" className={styles.linkBtn}>
                Dashboard view →
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </OfficeShell>
  );
}
