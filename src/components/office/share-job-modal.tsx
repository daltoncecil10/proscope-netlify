"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./office.module.css";
import type { DashboardJob } from "@/lib/dashboard/types";
import { createOwnerSharePackage } from "@/lib/share/provider";
import {
  buildShareMessage,
  copyToClipboard,
  openSmsShare,
  shareLink,
} from "@/lib/share/share-actions";
import type { TeamMemberRecord } from "@/lib/team/store";
import { shareJobInternally } from "@/lib/team/store";

type ShareJobModalProps = {
  open: boolean;
  jobs: DashboardJob[];
  members: TeamMemberRecord[];
  userId: string;
  ownerEmail: string;
  initialJobId?: string;
  onClose: () => void;
  onShared: () => void;
};

export function ShareJobModal({
  open,
  jobs,
  members,
  userId,
  ownerEmail,
  initialJobId,
  onClose,
  onShared,
}: ShareJobModalProps) {
  const [jobId, setJobId] = useState(initialJobId ?? "");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const job = useMemo(() => jobs.find((j) => j.id === jobId) ?? null, [jobs, jobId]);
  const teammates = useMemo(
    () => members.filter((m) => m.status === "active" && m.role !== "owner"),
    [members]
  );

  useEffect(() => {
    if (!open) return;
    setJobId(initialJobId ?? jobs[0]?.id ?? "");
    setSelectedEmails(new Set());
    setExternalUrl(null);
    setError(null);
    setStatus(null);
  }, [open, initialJobId, jobs]);

  if (!open) return null;

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const createExternalLink = async () => {
    if (!job) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const pkg = await createOwnerSharePackage({
        primaryJobId: job.id,
        title: job.title,
        address: job.address,
        inspectorName: job.inspectorName,
      });
      setExternalUrl(pkg.url);
      setStatus("External link created.");
    } catch (err) {
      setError((err as Error)?.message ?? "Could not create share link.");
    } finally {
      setBusy(false);
    }
  };

  const shareInternal = async () => {
    if (!job) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      let url = externalUrl;
      if (!url) {
        const pkg = await createOwnerSharePackage({
          primaryJobId: job.id,
          title: job.title,
          address: job.address,
          inspectorName: job.inspectorName,
        });
        url = pkg.url;
        setExternalUrl(url);
      }
      shareJobInternally(userId, ownerEmail, {
        jobId: job.id,
        jobTitle: job.title,
        jobAddress: job.address,
        teammateEmails: [...selectedEmails],
        externalShareUrl: url,
      });
      setStatus("Job shared with your team.");
      onShared();
    } catch (err) {
      setError((err as Error)?.message ?? "Could not share job.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!externalUrl || !job) return;
    try {
      await copyToClipboard(externalUrl);
      setStatus("Link copied.");
    } catch {
      setError("Clipboard not available.");
    }
  };

  const textLink = () => {
    if (!externalUrl || !job) return;
    openSmsShare(buildShareMessage(job.title, externalUrl));
  };

  const nativeShare = async () => {
    if (!externalUrl || !job) return;
    await shareLink(job.title, externalUrl);
  };

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Share a job</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span>Job</span>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.address}
                </option>
              ))}
            </select>
          </label>

          {teammates.length ? (
            <div className={styles.sharePanel}>
              <div className={styles.sharePanelTitle}>Share internally</div>
              {teammates.map((member) => (
                <label key={member.id} className={styles.shareCheckRow}>
                  <input
                    type="checkbox"
                    checked={selectedEmails.has(member.email)}
                    onChange={() => toggleEmail(member.email)}
                  />
                  <span>{member.email}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className={styles.modalHint}>Invite teammates first to share jobs internally.</p>
          )}

          <div className={styles.sharePanel}>
            <div className={styles.sharePanelTitle}>External link</div>
            {externalUrl ? (
              <input className={styles.shareUrlField} readOnly value={externalUrl} />
            ) : (
              <p className={styles.modalHint}>Create a view-only link for adjusters or clients.</p>
            )}
            <div className={styles.modalActions} style={{ justifyContent: "flex-start" }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => void createExternalLink()}
                disabled={busy || !job}
              >
                {externalUrl ? "Refresh link" : "Create link"}
              </button>
              {externalUrl ? (
                <>
                  <button type="button" className={styles.btnSecondary} onClick={() => void copyLink()}>
                    Copy
                  </button>
                  <button type="button" className={styles.btnSecondary} onClick={textLink}>
                    Text (SMS)
                  </button>
                  <button type="button" className={styles.btnSecondary} onClick={() => void nativeShare()}>
                    Share…
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {status ? <p className={styles.modalHint}>{status}</p> : null}

          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>
              Close
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void shareInternal()}
              disabled={busy || !job || (!selectedEmails.size && !externalUrl)}
            >
              {busy ? "Sharing…" : "Share with team"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
