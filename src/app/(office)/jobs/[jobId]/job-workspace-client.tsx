"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OfficeShell } from "@/components/office/office-shell";
import styles from "@/components/office/office.module.css";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";
import {
  deleteDashboardPhoto,
  getDashboardJob,
  listDashboardPhotos,
  updateDashboardJob,
  updateDashboardPhoto,
} from "@/lib/dashboard/provider";
import type { DashboardJob, DashboardPhoto } from "@/lib/dashboard/types";
import {
  daysUntil,
  formatExpiresLabel,
  formatInspected,
  statusClassName,
  statusLabel,
} from "@/lib/dashboard/utils";
import { createOwnerSharePackage } from "@/lib/share/provider";
type JobTab = "report" | "photos" | "details";

const PHOTO_SECTIONS = ["All", "Roof slopes", "Exterior", "Structures", "Interior", "Damages"];

export function JobWorkspaceClient({ jobId }: { jobId: string }) {
  const { user } = useOfficeAuth();
  const [job, setJob] = useState<DashboardJob | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<JobTab>("report");
  const [photos, setPhotos] = useState<DashboardPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photoSection, setPhotoSection] = useState("All");
  const [photoSearch, setPhotoSearch] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerCaption, setViewerCaption] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    title: "",
    address: "",
    status: "",
    notes: "",
  });

  const loadJob = useCallback(
    async (userId: string) => {
      setLoadError(null);
      try {
        const row = await getDashboardJob(userId, jobId);
        if (!row) {
          setLoadError("Job not found");
          setJob(null);
          return;
        }
        setJob(row);
        setDetailsForm({
          title: row.title,
          address: row.address,
          status: row.rawStatus ?? row.status,
          notes: row.notes ?? "",
        });
      } catch (err) {
        setLoadError((err as Error)?.message ?? "Failed to load job");
      }
    },
    [jobId]
  );

  useEffect(() => {
    if (!user?.id) return;
    void loadJob(user.id);
  }, [user?.id, loadJob]);

  useEffect(() => {
    if (tab !== "photos" || !jobId) return;
    let active = true;
    setPhotosLoading(true);
    void listDashboardPhotos(jobId)
      .then((rows) => {
        if (active) setPhotos(rows);
      })
      .finally(() => {
        if (active) setPhotosLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, jobId]);

  const filteredPhotos = useMemo(() => {
    const q = photoSearch.trim().toLowerCase();
    return photos.filter((p) => {
      const section = (p.category ?? "Uncategorized").trim();
      if (photoSection !== "All" && section !== photoSection) return false;
      if (!q) return true;
      return (p.caption ?? "").toLowerCase().includes(q);
    });
  }, [photos, photoSection, photoSearch]);

  const photosBySection = useMemo(() => {
    const map = new Map<string, DashboardPhoto[]>();
    for (const p of filteredPhotos) {
      const key = (p.category ?? "Uncategorized").trim() || "Uncategorized";
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [filteredPhotos]);

  const openViewer = (photo: DashboardPhoto) => {
    const idx = filteredPhotos.findIndex((p) => p.id === photo.id);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerCaption(photo.caption ?? "");
  };

  const persistViewerCaption = async () => {
    if (viewerIndex === null) return;
    const photo = filteredPhotos[viewerIndex];
    if (!photo) return;
    await updateDashboardPhoto(photo.id, { caption: viewerCaption.trim() || null });
    setPhotos((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, caption: viewerCaption.trim() || null } : p))
    );
  };

  const saveDetails = async () => {
    if (!job) return;
    setSavingDetails(true);
    try {
      await updateDashboardJob(job.id, {
        title: detailsForm.title.trim() || job.title,
        address: detailsForm.address.trim() || job.address,
        status: detailsForm.status.trim() || null,
        notes: detailsForm.notes.trim() || null,
      });
      if (user) await loadJob(user.id);
    } catch (err) {
      window.alert((err as Error)?.message ?? "Could not save");
    } finally {
      setSavingDetails(false);
    }
  };

  const createShare = async () => {
    if (!job) return;
    try {
      const created = await createOwnerSharePackage({
        primaryJobId: job.id,
        title: `${job.title} - Inspection Package`,
        address: job.address,
      });
      window.open(created.url, "_blank", "noopener,noreferrer");
      if (user) await loadJob(user.id);
    } catch (err) {
      window.alert((err as Error)?.message ?? "Could not create share link");
    }
  };

  useEffect(() => {
    if (viewerIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void persistViewerCaption();
        setViewerIndex(null);
      }
      if (e.key === "ArrowLeft" && viewerIndex > 0) {
        void persistViewerCaption();
        setViewerIndex(viewerIndex - 1);
        setViewerCaption(filteredPhotos[viewerIndex - 1]?.caption ?? "");
      }
      if (e.key === "ArrowRight" && viewerIndex < filteredPhotos.length - 1) {
        void persistViewerCaption();
        setViewerIndex(viewerIndex + 1);
        setViewerCaption(filteredPhotos[viewerIndex + 1]?.caption ?? "");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerIndex, filteredPhotos, viewerCaption]);

  if (loadError || !job) {
    return (
      <div className={styles.error} style={{ padding: 48 }}>
        {loadError ?? "Job not found"}{" "}
        <Link href="/jobs" className={styles.linkBtn}>
          Back to jobs
        </Link>
      </div>
    );
  }

  const inspected = formatInspected(job.inspectedAt);
  const expiresDays = daysUntil(job.expiresAt);
  const pdfInline = job.pdfUrl
    ? job.pdfUrl.includes("?")
      ? `${job.pdfUrl}&inline=1`
      : `${job.pdfUrl}?inline=1`
    : null;

  return (
    <OfficeShell
      activeNav="jobs"
      variant="job"
      user={user}
      jobCount={0}
      topbarEnd={
        <>
          <button type="button" className={styles.btnSecondary}>
            Edit
          </button>
          <button type="button" className={styles.btnSecondary} title="More">
            ⋯
          </button>
        </>
      }
      crumbs={null}
    >
      <div className={styles.jobHeader}>
        <h1 className={styles.jobTitle}>{job.title}</h1>
        <p className={styles.jobCellAddr} style={{ margin: 0 }}>
          📍 {job.address}
        </p>
        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`${styles.statusPill} ${statusClassName(job.status, styles)}`}>
            <span className={styles.statusDot} />
            {statusLabel(job)}
          </span>
          {expiresDays !== null ? (
            <span className={styles.monoMute}>Expires in {formatExpiresLabel(job.expiresAt)}</span>
          ) : null}
        </div>
        <div className={styles.jobMetaLine}>
          <span>
            <strong>Inspector</strong> {job.inspectorName}
          </span>
          <span>
            <strong>Photos</strong> {job.photoCount}
          </span>
          <span>
            <strong>Captured</strong> {inspected.date}
          </span>
          <span>
            <strong>Auto-delete</strong> {formatExpiresLabel(job.expiresAt)}
          </span>
        </div>
        <div className={styles.jobHeaderActions}>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={!job.pdfUrl}
            onClick={() => job.pdfUrl && window.open(job.pdfUrl, "_blank")}
          >
            Send report ▾
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => void createShare()}>
            Share link ▾
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={!job.pdfUrl}
            onClick={() => job.pdfUrl && window.open(job.pdfUrl, "_blank")}
          >
            Download .zip ▾
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        {(["report", "photos", "details"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "report" ? "Report" : t === "photos" ? `Photos (${job.photoCount})` : "Details"}
          </button>
        ))}
      </div>

      {tab === "report" ? (
        <div className={styles.tabPanel}>
          <div className={styles.reportLayout}>
            {pdfInline ? (
              <iframe className={styles.reportFrame} src={pdfInline} title="Scope report" />
            ) : (
              <div className={`${styles.reportFrame} ${styles.loading}`}>
                Report PDF is not ready yet. Check back after the mobile inspection syncs.
              </div>
            )}
            <aside className={styles.reportRail}>
              <div className={styles.railCard}>
                <h4>Downloads</h4>
                <div className={styles.railList}>
                  <button
                    type="button"
                    className={`${styles.btnSecondary} ${styles.railBtn}`}
                    disabled={!job.pdfUrl}
                    onClick={() => job.pdfUrl && window.open(job.pdfUrl, "_blank")}
                  >
                    Full report (PDF)
                  </button>
                  <button type="button" className={`${styles.btnSecondary} ${styles.railBtn}`}>
                    Full job (.zip)
                  </button>
                </div>
              </div>
              <div className={styles.railCard}>
                <h4>Report metadata</h4>
                <p className={styles.monoMute} style={{ margin: 0 }}>
                  Status: {statusLabel(job)}
                  <br />
                  Last updated: {inspected.date}
                </p>
              </div>
            </aside>
          </div>
        </div>
      ) : null}

      {tab === "photos" ? (
        <div className={styles.tabPanel}>
          <div className={styles.photoToolbar}>
            <input
              className={styles.searchInput}
              style={{ maxWidth: 280 }}
              placeholder="Search captions…"
              value={photoSearch}
              onChange={(e) => setPhotoSearch(e.target.value)}
            />
            <div className={styles.chips}>
              {PHOTO_SECTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.chip} ${photoSection === s ? styles.chipActive : ""}`}
                  onClick={() => setPhotoSection(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {photosLoading ? (
            <p className={styles.loading}>Loading photos…</p>
          ) : (
            Array.from(photosBySection.entries()).map(([section, sectionPhotos]) => (
              <div key={section} className={styles.photoSection}>
                <div className={styles.photoSectionHead}>
                  <h3>{section}</h3>
                  <button type="button" className={styles.btnSecondary}>
                    Download section
                  </button>
                </div>
                <div className={styles.photoGrid}>
                  {sectionPhotos.map((photo, i) =>
                    photo.signed_url ? (
                      <div
                        key={photo.id}
                        className={styles.photoCard}
                        onClick={() => openViewer(photo)}
                        onKeyDown={(e) => e.key === "Enter" && openViewer(photo)}
                        role="button"
                        tabIndex={0}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.signed_url} alt={photo.caption ?? "Photo"} />
                        <div className={styles.photoCardFoot}>
                          #{i + 1} {photo.caption ?? "Untitled"}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            ))
          )}
          {!photosLoading && !filteredPhotos.length ? (
            <p className={styles.loading}>No photos for this job yet.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "details" ? (
        <div className={styles.tabPanel}>
          <div className={styles.detailsGrid}>
            <div className={styles.detailCard}>
              <h3>Property</h3>
              <div className={styles.field}>
                <label htmlFor="job-address">Address</label>
                <input
                  id="job-address"
                  value={detailsForm.address}
                  onChange={(e) =>
                    setDetailsForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className={styles.detailCard}>
              <h3>Claim information</h3>
              <p className={styles.monoMute} style={{ margin: 0 }}>
                Claim #, policy, and carrier fields will sync from the mobile app in a future
                update.
              </p>
            </div>
            <div className={styles.detailCard}>
              <h3>Insured</h3>
              <p className={styles.monoMute} style={{ margin: 0 }}>
                Insured contact fields will sync from the mobile app in a future update.
              </p>
            </div>
            <div className={styles.detailCard}>
              <h3>Job</h3>
              <div className={styles.field}>
                <label htmlFor="job-title">Title</label>
                <input
                  id="job-title"
                  value={detailsForm.title}
                  onChange={(e) => setDetailsForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="job-status">Status</label>
                <input
                  id="job-status"
                  value={detailsForm.status}
                  onChange={(e) => setDetailsForm((f) => ({ ...f, status: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="job-notes">Notes</label>
                <textarea
                  id="job-notes"
                  rows={4}
                  value={detailsForm.notes}
                  onChange={(e) => setDetailsForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label>Auto-delete date</label>
                <input readOnly value={job.expiresAt ? new Date(job.expiresAt).toLocaleDateString() : "—"} />
              </div>
              <div className={styles.saveRow}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={savingDetails}
                  onClick={() => void saveDetails()}
                >
                  {savingDetails ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewerIndex !== null && filteredPhotos[viewerIndex]?.signed_url ? (
        <div className={styles.photoViewer} role="dialog" aria-modal>
          <div className={styles.photoViewerMain}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={filteredPhotos[viewerIndex].signed_url!}
              alt={viewerCaption || "Photo"}
            />
          </div>
          <div className={styles.photoViewerBar}>
            <label>
              Caption
              <input
                value={viewerCaption}
                onChange={(e) => setViewerCaption(e.target.value)}
                onBlur={() => void persistViewerCaption()}
              />
            </label>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                if (viewerIndex > 0) {
                  void persistViewerCaption();
                  setViewerIndex(viewerIndex - 1);
                  setViewerCaption(filteredPhotos[viewerIndex - 1]?.caption ?? "");
                }
              }}
            >
              ← Prev
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                if (viewerIndex < filteredPhotos.length - 1) {
                  void persistViewerCaption();
                  setViewerIndex(viewerIndex + 1);
                  setViewerCaption(filteredPhotos[viewerIndex + 1]?.caption ?? "");
                }
              }}
            >
              Next →
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void persistViewerCaption().then(() => setViewerIndex(null))}
            >
              Close
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                const photo = filteredPhotos[viewerIndex];
                if (!photo || !window.confirm("Delete this photo?")) return;
                void deleteDashboardPhoto(photo.id).then(() => {
                  setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                  setViewerIndex(null);
                });
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </OfficeShell>
  );
}
