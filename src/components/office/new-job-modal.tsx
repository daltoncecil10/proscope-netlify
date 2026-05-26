"use client";

import { useEffect, useState } from "react";
import styles from "./office.module.css";
import type { CalendarEventType } from "@/lib/calendar/events";
import { eventTypeLabel } from "@/lib/calendar/events";

export type NewJobFormValues = {
  title: string;
  address: string;
  date: string;
  time: string;
  eventType: CalendarEventType;
  notes: string;
};

type NewJobModalProps = {
  open: boolean;
  title?: string;
  initialDate?: Date;
  saving: boolean;
  error: string | null;
  showEventType?: boolean;
  onClose: () => void;
  onSubmit: (values: NewJobFormValues) => void;
};

const EVENT_TYPES: CalendarEventType[] = ["inspection", "bei", "adjuster", "admin"];

function defaultForm(initialDate?: Date): NewJobFormValues {
  const base = initialDate ?? new Date();
  const date = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
  const time = `${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}`;
  return {
    title: "",
    address: "",
    date,
    time,
    eventType: "inspection",
    notes: "",
  };
}

export function NewJobModal({
  open,
  title = "New job",
  initialDate,
  saving,
  error,
  showEventType = true,
  onClose,
  onSubmit,
}: NewJobModalProps) {
  const [form, setForm] = useState<NewJobFormValues>(() => defaultForm(initialDate));

  useEffect(() => {
    if (open) setForm(defaultForm(initialDate));
  }, [open, initialDate]);

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form
          className={styles.modalBody}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <label className={styles.field}>
            <span>Title / homeowner</span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Smith residence — annual inspection"
              required
              autoFocus
            />
          </label>
          <label className={styles.field}>
            <span>Address</span>
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="123 Main St, Louisville, KY"
              required
            />
          </label>
          <div className={styles.modalRow}>
            <label className={styles.field}>
              <span>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Time</span>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                required
              />
            </label>
          </div>
          {showEventType ? (
            <label className={styles.field}>
              <span>Event type</span>
              <select
                value={form.eventType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, eventType: e.target.value as CalendarEventType }))
                }
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {eventTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={styles.field}>
            <span>Notes (optional)</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <p className={styles.modalHint}>
            Syncs to the ProScope mobile app under your signed-in account ({`same email`}).
          </p>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? "Saving…" : "Save job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function formValuesToScheduledAt(values: NewJobFormValues): Date {
  const [year, month, day] = values.date.split("-").map(Number);
  const [hour, minute] = values.time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}
