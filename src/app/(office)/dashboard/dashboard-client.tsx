"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleCard } from "@/components/office/collapsible-card";
import {
  formValuesToScheduledAt,
  NewJobModal,
  type NewJobFormValues,
} from "@/components/office/new-job-modal";
import { OfficeShell } from "@/components/office/office-shell";
import styles from "@/components/office/office.module.css";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";
import { createCalendarEvent } from "@/lib/calendar/events";
import { formatEventTime } from "@/lib/calendar/events";
import { listDashboardJobs } from "@/lib/dashboard/provider";
import type { DashboardJob } from "@/lib/dashboard/types";
import { daysUntil, filterJob, formatExpiresLabel } from "@/lib/dashboard/utils";

function welcomeDateLine() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function hoursAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const h = Math.floor((Date.now() - t) / (1000 * 60 * 60));
  if (h < 1) return "Edited just now";
  if (h < 24) return `Edited ${h}h ago`;
  const d = Math.floor(h / 24);
  return `Edited ${d}d ago`;
}

export function DashboardClient() {
  const { user } = useOfficeAuth();
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refreshJobs = useCallback(async (userId: string) => {
    setJobsLoading(true);
    try {
      setJobs(await listDashboardJobs(userId));
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void refreshJobs(user.id);
  }, [user?.id, refreshJobs]);

  const readyCount = useMemo(() => jobs.filter((j) => j.status === "ready").length, [jobs]);
  const expiringCount = useMemo(
    () => jobs.filter((j) => filterJob(j, "expiring_soon")).length,
    [jobs]
  );
  const inProgressJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "in_progress" || j.status === "draft")
        .slice(0, 4),
    [jobs]
  );
  const expiringJobs = useMemo(
    () =>
      jobs
        .filter((j) => filterJob(j, "expiring_soon"))
        .sort((a, b) => {
          const da = daysUntil(a.expiresAt) ?? 999;
          const db = daysUntil(b.expiresAt) ?? 999;
          return da - db;
        })
        .slice(0, 5),
    [jobs]
  );
  const beiJobs = useMemo(
    () => jobs.filter((j) => (j.notes ?? "").includes("[type:bei]")).slice(0, 3),
    [jobs]
  );

  const weekDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      const isToday = i === 0;
      const dayJobs = jobs.filter((j) => {
        if (!j.scheduledAt) return false;
        const jd = new Date(j.scheduledAt);
        return (
          jd.getFullYear() === d.getFullYear() &&
          jd.getMonth() === d.getMonth() &&
          jd.getDate() === d.getDate()
        );
      });
      return { d, label, isToday, dayJobs };
    });
  }, [jobs]);

  const createJob = async (values: NewJobFormValues, eventType: "inspection" | "bei") => {
    if (!user?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createCalendarEvent(user.id, {
        title: values.title,
        address: values.address,
        scheduledAt: formValuesToScheduledAt(values),
        eventType,
        notes: values.notes,
      });
      setNewJobOpen(false);
      setRepairOpen(false);
      await refreshJobs(user.id);
    } catch (err) {
      setSaveError((err as Error)?.message ?? "Failed to create job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OfficeShell
      activeNav="dashboard"
      user={user}
      jobCount={jobs.length}
      crumbs={
        <>
          <span>ProScope Office</span>
          <span className={styles.crumbsHere}>/ Dashboard</span>
        </>
      }
      topbarEnd={
        <button type="button" className={styles.btnPrimary} onClick={() => setNewJobOpen(true)}>
          + New job
        </button>
      }
    >
      <div className={styles.content}>
        <h1 className={styles.welcomeH1}>{welcomeDateLine()}</h1>
        <p className={styles.welcomeSub}>
          {jobsLoading ? (
            "Loading your office…"
          ) : (
            <>
              <Link href="/jobs">{jobs.length} inspections</Link>
              {" · "}
              <Link href="/jobs">{expiringCount} expiring soon</Link>
            </>
          )}
        </p>

        <div className={styles.qaGrid}>
          <button type="button" className={styles.qaCard} onClick={() => setNewJobOpen(true)}>
            <span className={styles.qaIcon}>+</span>
            <span className={styles.qaTitle}>New job</span>
            <span className={styles.qaFoot}>Syncs to mobile app</span>
          </button>
          <button
            type="button"
            className={`${styles.qaCard} ${styles.qaCardRepair}`}
            onClick={() => setRepairOpen(true)}
          >
            <span className={styles.qaIcon}>◆</span>
            <span className={styles.qaTitle}>Repairability assessment</span>
            <span className={styles.qaFoot}>Schedule BEI field work</span>
          </button>
          <Link href="/jobs" className={styles.qaCard}>
            <span className={styles.qaIcon}>◎</span>
            <span className={styles.qaTitle}>Browse jobs</span>
            <span className={styles.qaFoot}>{readyCount} ready to send</span>
          </Link>
          <Link href="/team" className={styles.qaCard}>
            <span className={styles.qaIcon}>👥</span>
            <span className={styles.qaTitle}>Team & sharing</span>
            <span className={styles.qaFoot}>Invite teammates</span>
          </Link>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>This week</div>
          <div className={styles.weekStrip}>
            {weekDays.map(({ label, isToday, dayJobs }) => (
              <div
                key={label}
                className={`${styles.weekDay} ${isToday ? styles.weekDayToday : ""}`}
              >
                <div className={styles.weekDayLabel}>{label}</div>
                {dayJobs.length ? (
                  dayJobs.slice(0, 2).map((j) => (
                    <Link key={j.id} href={`/jobs/${j.id}`} className={styles.weekEv}>
                      <div className={styles.weekEvTime}>
                        {j.scheduledAt ? formatEventTime(j.scheduledAt) : "—"}
                      </div>
                      {j.title}
                    </Link>
                  ))
                ) : (
                  <div className={styles.weekEv} style={{ color: "var(--ink-faint)" }}>
                    —
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className={styles.twoCol}>
          <CollapsibleCard
            title="In progress"
            actions={
              <Link href="/jobs" className={styles.linkBtn}>
                View all
              </Link>
            }
          >
            <div className={styles.ipGrid}>
              {inProgressJobs.length ? (
                inProgressJobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className={styles.ipCard}>
                    <div className={styles.ipCover} />
                    <div className={styles.ipBody}>
                      <div className={styles.ipTitle}>{job.title}</div>
                      <div className={styles.ipMeta}>
                        {job.address} · {job.photoCount} photos
                      </div>
                    </div>
                    <div className={styles.ipFoot}>
                      <span>{hoursAgo(job.inspectedAt)}</span>
                      <span>Continue →</span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className={styles.loading} style={{ gridColumn: "1 / -1" }}>
                  No in-progress jobs.
                </p>
              )}
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Expiring soon">
            <div className={styles.expireList}>
              {expiringJobs.length ? (
                expiringJobs.map((job) => {
                  const d = daysUntil(job.expiresAt);
                  const critical = d !== null && d <= 1;
                  const label = formatExpiresLabel(job.expiresAt);
                  const unit =
                    d === 1 ? "day" : d !== null && d < 24 ? "hours" : "days";
                  return (
                    <div key={job.id} className={styles.expireItem}>
                      <div>
                        <div
                          className={`${styles.expireCount} ${
                            critical
                              ? styles.expireCountCritical
                              : styles.expireCountWarn
                          }`}
                        >
                          {label.replace(/d$|hours|Today|Expired/g, "").trim() || label}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--ink-mute)",
                            textTransform: "uppercase",
                          }}
                        >
                          {unit}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{job.title}</div>
                        <div className={styles.ipMeta}>{job.address}</div>
                      </div>
                      <Link href={`/jobs/${job.id}`} className={styles.rowActionBtn}>
                        ↓
                      </Link>
                    </div>
                  );
                })
              ) : (
                <p className={styles.loading}>Nothing expiring in the next 7 days.</p>
              )}
            </div>
          </CollapsibleCard>
        </div>

        <section className={`${styles.card} ${styles.repairSection}`}>
          <div className={`${styles.cardHeader} ${styles.repairHeader}`}>
            Repairability Assessments (BEI)
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-mute)" }}>
              • Field workflow in ProScope mobile
            </span>
          </div>
          <div className={styles.repairGrid}>
            <div className={styles.repairHero}>
              <span style={{ color: "var(--bei)", fontSize: 20 }}>◆</span>
              <h3>Schedule a Repairability Assessment</h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>
                Creates a job in your account and opens in the mobile app.
              </p>
              <button
                type="button"
                className={styles.linkBtn}
                style={{ marginTop: 12, display: "inline-block", border: "none", background: "none", cursor: "pointer" }}
                onClick={() => setRepairOpen(true)}
              >
                Schedule assessment →
              </button>
            </div>
            {beiJobs.length ? (
              beiJobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className={styles.raCard}>
                  <span className={styles.statusPill} style={{ marginBottom: 8 }}>
                    {job.status === "ready" ? "Ready" : "Scheduled"}
                  </span>
                  <div style={{ fontWeight: 600 }}>{job.title}</div>
                  <p style={{ margin: "6px 0", fontSize: 11, color: "var(--ink-mute)" }}>
                    {job.address}
                  </p>
                </Link>
              ))
            ) : (
              <div className={styles.raCard}>
                <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                  No repairability jobs yet — schedule one above.
                </span>
              </div>
            )}
            <div className={styles.raCard}>
              <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                {readyCount} scope reports ready to send
              </span>
              <Link href="/jobs" className={styles.linkBtn} style={{ display: "block", marginTop: 8 }}>
                Open jobs →
              </Link>
            </div>
          </div>
        </section>
      </div>

      <NewJobModal
        open={newJobOpen}
        title="New job"
        saving={saving}
        error={saveError}
        showEventType={false}
        onClose={() => {
          if (!saving) {
            setNewJobOpen(false);
            setSaveError(null);
          }
        }}
        onSubmit={(values) => void createJob(values, "inspection")}
      />

      <NewJobModal
        open={repairOpen}
        title="New Repairability Assessment"
        saving={saving}
        error={saveError}
        showEventType={false}
        onClose={() => {
          if (!saving) {
            setRepairOpen(false);
            setSaveError(null);
          }
        }}
        onSubmit={(values) => void createJob(values, "bei")}
      />
    </OfficeShell>
  );
}
