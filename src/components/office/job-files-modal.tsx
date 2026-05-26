"use client";

import { useEffect, useState } from "react";
import styles from "./office.module.css";
import { listDashboardPhotos } from "@/lib/dashboard/provider";
import type { DashboardJob, DashboardPhoto } from "@/lib/dashboard/types";
import { downloadJobPackage, downloadSinglePhoto } from "@/lib/jobs/package-download";

type JobFilesModalProps = {
  open: boolean;
  job: DashboardJob | null;
  onClose: () => void;
};

export function JobFilesModal({ open, job, onClose }: JobFilesModalProps) {
  const [photos, setPhotos] = useState<DashboardPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !job) return;
    let active = true;
    setLoading(true);
    setError(null);
    void listDashboardPhotos(job.id)
      .then((rows) => {
        if (active) setPhotos(rows);
      })
      .catch((err) => {
        if (active) setError((err as Error)?.message ?? "Failed to load photos");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, job]);

  useEffect(() => {
    if (!open) {
      setViewerIndex(null);
      setPhotos([]);
    }
  }, [open]);

  if (!open || !job) return null;

  const viewerPhoto = viewerIndex !== null ? photos[viewerIndex] : null;

  const downloadZip = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadJobPackage(job);
    } catch (err) {
      setError((err as Error)?.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const downloadPhoto = async (photo: DashboardPhoto, index: number) => {
    if (!photo.signed_url) return;
    const name = photo.caption?.trim() || `photo-${index + 1}`;
    try {
      await downloadSinglePhoto(photo.signed_url, `${name}.jpg`);
    } catch (err) {
      setError((err as Error)?.message ?? "Could not download photo");
    }
  };

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={`${styles.modalCard} ${styles.modalCardWide}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Files — {job.title}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalActions} style={{ justifyContent: "flex-start", marginBottom: 12 }}>
            {job.pdfUrl ? (
              <a href={job.pdfUrl} target="_blank" rel="noopener noreferrer" className={styles.btnSecondary}>
                Open PDF
              </a>
            ) : null}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void downloadZip()}
              disabled={downloading}
            >
              {downloading ? "Preparing…" : "Download .zip"}
            </button>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {loading ? <p className={styles.loading}>Loading photos…</p> : null}

          {!loading && photos.length === 0 ? (
            <p className={styles.modalHint}>No photos uploaded yet for this job.</p>
          ) : null}

          <div className={styles.jobViewerGrid}>
            {photos.map((photo, index) => (
              <div key={photo.id} className={styles.jobViewerTile}>
                {photo.signed_url ? (
                  <button
                    type="button"
                    className={styles.jobViewerThumbBtn}
                    onClick={() => setViewerIndex(index)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.signed_url} alt={photo.caption ?? "Inspection photo"} />
                  </button>
                ) : (
                  <div className={styles.jobViewerPlaceholder}>No preview</div>
                )}
                <div className={styles.jobViewerMeta}>
                  <span>{photo.caption ?? "Untitled"}</span>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => void downloadPhoto(photo, index)}
                    disabled={!photo.signed_url}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {viewerPhoto?.signed_url ? (
          <div className={styles.viewerOverlay} onClick={() => setViewerIndex(null)}>
            <div className={styles.viewerFrame} onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={viewerPhoto.signed_url} alt={viewerPhoto.caption ?? "Photo"} />
              <div className={styles.viewerBar}>
                <span>{viewerPhoto.caption ?? "Untitled photo"}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => void downloadPhoto(viewerPhoto, viewerIndex ?? 0)}
                  >
                    Download
                  </button>
                  <button type="button" className={styles.btnSecondary} onClick={() => setViewerIndex(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
