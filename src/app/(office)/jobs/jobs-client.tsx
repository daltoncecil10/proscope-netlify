"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JobEditModal } from "@/components/office/job-edit-modal";
import { JobFilesModal } from "@/components/office/job-files-modal";
import {
  formValuesToScheduledAt,
  NewJobModal,
  type NewJobFormValues,
} from "@/components/office/new-job-modal";
import { OfficeShell } from "@/components/office/office-shell";
import { ShareJobModal } from "@/components/office/share-job-modal";
import styles from "@/components/office/office.module.css";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";
import { createCalendarEvent } from "@/lib/calendar/events";
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
import { downloadJobPackage } from "@/lib/jobs/package-download";
import { listTeamMembers } from "@/lib/team/store";
import { createOwnerSharePackage } from "@/lib/share/provider";
import { copyToClipboard, shareLink } from "@/lib/share/share-actions";

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

function JobRowMenu({
  job,
  open,
  onToggle,
  onClose,
  onFiles,
  onEdit,
  onDownload,
  onShare,
}: {
  job: DashboardJob;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onFiles: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onShare: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  return (
    <div className={styles.rowMenuWrap} ref={ref}>
      <button type="button" className={styles.rowActionBtn} title="Actions" onClick={onToggle}>
        ⋯
      </button>
      {open ? (
        <div className={styles.rowMenu}>
          <Link href={`/jobs/${job.id}`} className={styles.rowMenuItem} onClick={onClose}>
            Open job
          </Link>
          <button type="button" className={styles.rowMenuItem} onClick={onFiles}>
            View files
          </button>
          <button type="button" className={styles.rowMenuItem} onClick={onDownload}>
            Download .zip
          </button>
          <button type="button" className={styles.rowMenuItem} onClick={onEdit}>
            Edit details
          </button>
          <button type="button" className={styles.rowMenuItem} onClick={onShare}>
            Share link
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function JobsClient() {
  const { user } = useOfficeAuth();
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuJobId, setMenuJobId] = useState<string | null>(null);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [newJobSaving, setNewJobSaving] = useState(false);
  const [newJobError, setNewJobError] = useState<string | null>(null);
  const [editJob, setEditJob] = useState<DashboardJob | null>(null);
  const [filesJob, setFilesJob] = useState<DashboardJob | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareJobId, setShareJobId] = useState<string | undefined>();
  const [bulkBusy, setBulkBusy] = useState(false);

  const ownerEmail = user?.email ?? "";

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
      upcoming: 0,
      expiring_soon: 0,
    };
    for (const j of jobs) {
      if (j.status === "ready") c.ready += 1;
      if (j.status === "in_progress") c.in_progress += 1;
      if (j.status === "draft") c.drafts += 1;
      if (j.status === "scheduled") c.upcoming += 1;
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

  const createJob = async (values: NewJobFormValues) => {
    if (!user?.id) return;
    setNewJobSaving(true);
    setNewJobError(null);
    try {
      await createCalendarEvent(user.id, {
        title: values.title,
        address: values.address,
        scheduledAt: formValuesToScheduledAt(values),
        eventType: "inspection",
        notes: values.notes,
      });
      setNewJobOpen(false);
      await refreshJobs(user.id);
    } catch (err) {
      setNewJobError((err as Error)?.message ?? "Failed to create job");
    } finally {
      setNewJobSaving(false);
    }
  };

  const downloadJob = async (job: DashboardJob) => {
    try {
      await downloadJobPackage(job);
    } catch (err) {
      window.alert((err as Error)?.message ?? "Download failed");
    }
  };

  const quickShare = async (job: DashboardJob) => {
    try {
      const url =
        job.shareUrl ??
        (
          await createOwnerSharePackage({
            primaryJobId: job.id,
            title: job.title,
            address: job.address,
            inspectorName: job.inspectorName,
          })
        ).url;
      await shareLink(job.title, url);
    } catch (err) {
      try {
        const url = job.shareUrl;
        if (url) await copyToClipboard(url);
      } catch {
        window.alert((err as Error)?.message ?? "Could not share");
      }
    }
  };

  const bulkDownload = async () => {
    const selected = jobs.filter((j) => selectedIds.has(j.id));
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      for (const job of selected) {
        await downloadJobPackage(job);
      }
    } catch (err) {
      window.alert((err as Error)?.message ?? "Bulk download failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const members = user?.id && ownerEmail ? listTeamMembers(user.id, ownerEmail) : [];

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
        <button type="button" className={styles.btnPrimary} onClick={() => setNewJobOpen(true)}>
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
              <button type="button" className={styles.linkBtn} onClick={() => setFilter("ready")}>
                View ready →
              </button>
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
                  ["upcoming", "Upcoming", counts.upcoming],
                  ["drafts", "Drafts", counts.drafts],
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
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <div className={styles.bulkBar}>
              <span>{selectedIds.size} selected</span>
              <div className={styles.bulkActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={bulkBusy}
                  onClick={() => void bulkDownload()}
                >
                  {bulkBusy ? "Downloading…" : "Download as .zip"}
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setShareJobId([...selectedIds][0]);
                    setShareOpen(true);
                  }}
                >
                  Share via link
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

          {jobsError ? (
            <p className={styles.error}>{jobsError}</p>
          ) : jobsLoading ? (
            <p className={styles.loading}>Loading jobs…</p>
          ) : (
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
                          <button
                            type="button"
                            className={styles.photoCountCell}
                            style={{ border: "none", background: "transparent", cursor: "pointer" }}
                            onClick={() => setFilesJob(job)}
                          >
                            <span aria-hidden>📷</span>
                            {job.photoCount}
                          </button>
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
                            <button
                              type="button"
                              className={styles.rowActionBtn}
                              title="Download package"
                              onClick={() => void downloadJob(job)}
                            >
                              ↓
                            </button>
                            <JobRowMenu
                              job={job}
                              open={menuJobId === job.id}
                              onToggle={() =>
                                setMenuJobId((prev) => (prev === job.id ? null : job.id))
                              }
                              onClose={() => setMenuJobId(null)}
                              onFiles={() => {
                                setMenuJobId(null);
                                setFilesJob(job);
                              }}
                              onEdit={() => {
                                setMenuJobId(null);
                                setEditJob(job);
                              }}
                              onDownload={() => {
                                setMenuJobId(null);
                                void downloadJob(job);
                              }}
                              onShare={() => {
                                setMenuJobId(null);
                                void quickShare(job);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.tableFoot}>
            <span>
              Showing {filteredJobs.length} of {jobs.length} jobs
            </span>
            <Link href="/dashboard" className={styles.linkBtn}>
              Dashboard view →
            </Link>
          </div>
        </section>
      </div>

      <NewJobModal
        open={newJobOpen}
        saving={newJobSaving}
        error={newJobError}
        showEventType={false}
        onClose={() => {
          if (!newJobSaving) setNewJobOpen(false);
        }}
        onSubmit={(values) => void createJob(values)}
      />

      <JobEditModal
        open={Boolean(editJob)}
        job={editJob}
        onClose={() => setEditJob(null)}
        onSaved={() => {
          if (user?.id) void refreshJobs(user.id);
        }}
      />

      <JobFilesModal open={Boolean(filesJob)} job={filesJob} onClose={() => setFilesJob(null)} />

      {user?.id && ownerEmail ? (
        <ShareJobModal
          open={shareOpen}
          jobs={jobs}
          members={members}
          userId={user.id}
          ownerEmail={ownerEmail}
          initialJobId={shareJobId}
          onClose={() => {
            setShareOpen(false);
            setShareJobId(undefined);
          }}
          onShared={() => {}}
        />
      ) : null}
    </OfficeShell>
  );
}
