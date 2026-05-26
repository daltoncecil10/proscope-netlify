import type { DashboardJob, DashboardJobStatus, ExpiresUrgency } from "./types";

const AUTO_DELETE_DAYS = 30;
const EXPIRING_SOON_DAYS = 7;
const EXPIRING_URGENT_DAYS = 3;

export function computeExpiresAt(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const base = new Date(updatedAt);
  if (Number.isNaN(base.getTime())) return null;
  const expires = new Date(base);
  expires.setDate(expires.getDate() + AUTO_DELETE_DAYS);
  return expires.toISOString();
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = target - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function expiresUrgency(expiresAt: string | null): ExpiresUrgency {
  const days = daysUntil(expiresAt);
  if (days === null) return "normal";
  if (days <= EXPIRING_URGENT_DAYS) return "urgent";
  if (days <= EXPIRING_SOON_DAYS) return "warn";
  return "normal";
}

export function formatExpiresLabel(expiresAt: string | null): string {
  const days = daysUntil(expiresAt);
  if (days === null) return "—";
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  if (days === 1) return "1d";
  return `${days}d`;
}

export function formatInspected(iso: string | null) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

export function formatScheduledLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (isSameDay(date, now)) return `Today ${time}`;
  if (isSameDay(date, tomorrow)) return `Tomorrow ${time}`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isFutureDate(iso: string | null): boolean {
  if (!iso) return false;
  const when = new Date(iso).getTime();
  return Number.isFinite(when) && when > Date.now();
}

/** Derive office status from PDF, photos, and appointment date — not the raw DB label alone. */
export function deriveJobStatus(input: {
  hasPdf: boolean;
  photoCount: number;
  scheduledAt: string | null;
  rawStatus: string | null;
}): DashboardJobStatus {
  const lower = (input.rawStatus ?? "").trim().toLowerCase();

  if (input.hasPdf || lower === "ready" || lower === "complete" || lower === "completed") {
    return "ready";
  }

  if (
    input.photoCount > 0 ||
    lower === "in_progress" ||
    lower === "in progress" ||
    lower === "active" ||
    lower === "inspecting"
  ) {
    return "in_progress";
  }

  if (isFutureDate(input.scheduledAt)) {
    return "scheduled";
  }

  return "draft";
}

export function statusLabel(job: DashboardJob): string {
  if (job.status === "ready") return "Ready";
  if (job.status === "in_progress") return "In progress";
  if (job.status === "scheduled") {
    return job.scheduledFor ?? "Upcoming";
  }
  return "Draft";
}

export function filterJob(
  job: DashboardJob,
  filter: import("./types").DashboardFilter
): boolean {
  if (filter === "trash") return false;
  if (filter === "all") return true;
  if (filter === "ready") return job.status === "ready";
  if (filter === "in_progress") return job.status === "in_progress";
  if (filter === "drafts") return job.status === "draft";
  if (filter === "upcoming") return job.status === "scheduled";
  if (filter === "expiring_soon") {
    const days = daysUntil(job.expiresAt);
    return days !== null && days >= 0 && days <= EXPIRING_SOON_DAYS;
  }
  return true;
}

export function statusClassName(
  status: DashboardJobStatus,
  styles: Record<string, string>
): string {
  if (status === "ready") return styles.statusReady;
  if (status === "in_progress") return styles.statusInProgress;
  if (status === "scheduled") return styles.statusScheduled;
  return styles.statusDraft;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
