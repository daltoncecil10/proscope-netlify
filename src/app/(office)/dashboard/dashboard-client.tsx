"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OfficeShell } from "@/components/office/office-shell";
import styles from "@/components/office/office.module.css";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";
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

  const weekDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      const isToday = i === 0;
      const dayJobs = jobs.filter((j) => {
        if (!j.inspectedAt) return false;
        const jd = new Date(j.inspectedAt);
        return (
          jd.getFullYear() === d.getFullYear() &&
          jd.getMonth() === d.getMonth() &&
          jd.getDate() === d.getDate()
        );
      });
      return { d, label, isToday, dayJobs };
    });
  }, [jobs]);

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
        <button type="button" className={styles.btnPrimary}>
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
          <button type="button" className={styles.qaCard}>
            <span className={styles.qaArrow}>↗</span>
            <span className={styles.qaIcon}>+</span>
            <span className={styles.qaTitle}>New job</span>
          </button>
          <Link href="/calendar" className={styles.qaCard}>
            <span className={styles.qaArrow}>↗</span>
            <span className={styles.qaIcon}>📅</span>
            <span className={styles.qaTitle}>Calendar</span>
          </Link>
          <a
            href="https://www.buildingexperts.institute/certifications-repairabilityassessor"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.qaCard} ${styles.qaCardRepair}`}
          >
            <span className={styles.qaArrow}>↗</span>
            <span className={styles.qaIcon}>◆</span>
            <span className={styles.qaTitle}>New Repairability Assessment</span>
          </a>
          <Link href="/jobs" className={styles.qaCard}>
            <span className={styles.qaArrow}>↗</span>
            <span className={styles.qaIcon}>◎</span>
            <span className={styles.qaTitle}>Open CRM</span>
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
                    <div key={j.id} className={styles.weekEv}>
                      <div className={styles.weekEvTime}>—</div>
                      {j.title}
                    </div>
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
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              In progress
              <Link href="/jobs" className={styles.linkBtn}>
                View all
              </Link>
            </div>
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
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>Expiring soon</div>
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
          </section>
        </div>

        <section className={`${styles.card} ${styles.repairSection}`}>
          <div className={`${styles.cardHeader} ${styles.repairHeader}`}>
            Repairability Assessments (BEI)
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-mute)" }}>
              • Powered by BEI · Building Experts Institute
            </span>
          </div>
          <div className={styles.repairGrid}>
            <div className={styles.repairHero}>
              <span style={{ color: "var(--bei)", fontSize: 20 }}>◆</span>
              <h3>Start a new Repairability Assessment</h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>
                Field workflow runs in the ProScope mobile app.
              </p>
              <a
                href="https://www.buildingexperts.institute/certifications-repairabilityassessor"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.linkBtn}
                style={{ marginTop: 12, display: "inline-block" }}
              >
                Begin assessment →
              </a>
            </div>
            <div className={styles.raCard}>
              <span className={styles.statusPill} style={{ marginBottom: 8 }}>
                In progress
              </span>
              <div style={{ fontWeight: 600 }}>Sample assessment</div>
              <p style={{ margin: "6px 0", fontSize: 11, color: "var(--ink-mute)" }}>
                Connect mobile sync to list active assessments here.
              </p>
              <div
                style={{
                  height: 4,
                  background: "var(--surface-3)",
                  borderRadius: 2,
                  marginTop: 8,
                }}
              >
                <div style={{ width: "45%", height: "100%", background: "var(--bei)" }} />
              </div>
            </div>
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
    </OfficeShell>
  );
}
