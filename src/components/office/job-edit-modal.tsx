"use client";

import { useEffect, useState } from "react";
import styles from "./office.module.css";
import type { DashboardJob } from "@/lib/dashboard/types";
import { updateDashboardJob } from "@/lib/dashboard/provider";

type JobEditModalProps = {
  open: boolean;
  job: DashboardJob | null;
  onClose: () => void;
  onSaved: () => void;
};

export function JobEditModal({ open, job, onClose, onSaved }: JobEditModalProps) {
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !job) return;
    setTitle(job.title);
    setAddress(job.address);
    setNotes(job.notes ?? "");
    setError(null);
  }, [open, job]);

  if (!open || !job) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDashboardJob(job.id, {
        title: title.trim() || job.title,
        address: address.trim() || job.address,
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? "Could not save job.");
    } finally {
      setSaving(false);
    }
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
          <h2 className={styles.modalTitle}>Edit job</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form
          className={styles.modalBody}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className={styles.field}>
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span>Address</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span>Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
