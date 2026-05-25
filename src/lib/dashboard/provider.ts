import { supabase } from "@/lib/supabase/client";
import {
  getDashboardReportActions,
  listOwnerSharePackages,
} from "@/lib/share/provider";
import type { DashboardJob, DashboardJobStatus, DashboardPhoto } from "./types";
import { computeExpiresAt } from "./utils";

type JobRow = {
  id: string;
  title: string | null;
  address: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PhotoRow = {
  id: string;
  job_id: string;
  caption: string | null;
  category: string | null;
  signed_url: string | null;
  created_at: string | null;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function hashColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 42% 42%)`;
}

function normalizeStatus(
  raw: string | null,
  hasPdf: boolean,
  scheduledFor: string | null
): DashboardJobStatus {
  const lower = (raw ?? "").trim().toLowerCase();
  if (scheduledFor) {
    const when = new Date(scheduledFor).getTime();
    if (Number.isFinite(when) && when > Date.now()) return "scheduled";
  }
  if (hasPdf || lower === "ready" || lower === "complete" || lower === "completed") {
    return "ready";
  }
  if (
    lower === "in_progress" ||
    lower === "in progress" ||
    lower === "active" ||
    lower === "inspecting"
  ) {
    return "in_progress";
  }
  if (lower === "scheduled") return "scheduled";
  return "draft";
}

function formatScheduledLabel(iso: string | null): string | null {
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

async function resolveInspector(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("inspector_name,email")
    .eq("id", userId)
    .maybeSingle();
  const name =
    (typeof data?.inspector_name === "string" && data.inspector_name.trim()) ||
    (typeof data?.email === "string" && data.email.split("@")[0]) ||
    "Inspector";
  return {
    name,
    initials: initialsFromName(name),
    color: hashColor(userId),
  };
}

async function countPhotosForJob(jobId: string): Promise<number> {
  const { count, error } = await supabase
    .from("attachment_photos")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  if (error) return 0;
  return count ?? 0;
}

async function mapRowToJob(
  row: JobRow,
  inspector: { name: string; initials: string; color: string }
): Promise<DashboardJob> {
  let pdfSizeBytes: number | null = null;
  let pdfUrl: string | null = null;
  let shareUrl: string | null = null;
  const scheduledFor: string | null = null;

  try {
    const actions = await getDashboardReportActions(row.id);
    pdfUrl = actions.reportUrl;
    shareUrl = actions.shareUrl;
  } catch {
    // Non-fatal
  }

  const packages = await listOwnerSharePackages(row.id).catch(() => []);
  const readyPackage = packages.find((p) => !p.isRevoked);
  if (readyPackage && !shareUrl) shareUrl = readyPackage.url;

  const photoCount = await countPhotosForJob(row.id);
  const hasPdf = Boolean(pdfUrl);
  const status = normalizeStatus(row.status, hasPdf, scheduledFor);
  const inspectedAt = row.updated_at ?? row.created_at;
  const updatedAt = row.updated_at;
  const expiresAt = computeExpiresAt(updatedAt);

  return {
    id: row.id,
    title: row.title?.trim() || "Untitled job",
    address: row.address?.trim() || "No address",
    status,
    inspectedAt,
    inspectorName: inspector.name,
    inspectorInitials: inspector.initials,
    inspectorColor: inspector.color,
    assigneeName: inspector.name,
    photoCount,
    expiresAt,
    pdfSizeBytes,
    pdfUrl,
    shareUrl,
    scheduledFor: status === "scheduled" ? formatScheduledLabel(scheduledFor) : null,
    rawStatus: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt,
  };
}

export async function listDashboardJobs(userId: string): Promise<DashboardJob[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,title,address,status,notes,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  const rows = (data ?? []) as JobRow[];
  const inspector = await resolveInspector(userId);
  return Promise.all(rows.map((row) => mapRowToJob(row, inspector)));
}

export async function getDashboardJob(
  userId: string,
  jobId: string
): Promise<DashboardJob | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,title,address,status,notes,created_at,updated_at")
    .eq("user_id", userId)
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const inspector = await resolveInspector(userId);
  return mapRowToJob(data as JobRow, inspector);
}

export async function listDashboardPhotos(jobId: string): Promise<DashboardPhoto[]> {
  const { data, error } = await supabase
    .from("attachment_photos")
    .select("id,job_id,caption,category,signed_url,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return ((data ?? []) as PhotoRow[]).map((row) => ({
    id: row.id,
    job_id: row.job_id,
    caption: row.caption,
    category: row.category,
    signed_url: row.signed_url,
    created_at: row.created_at,
  }));
}

export async function updateDashboardJob(
  jobId: string,
  patch: Partial<Pick<JobRow, "title" | "address" | "status" | "notes">>
): Promise<void> {
  const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);
  if (error) throw error;
}

export async function updateDashboardPhoto(
  photoId: string,
  patch: { caption?: string | null; category?: string | null }
): Promise<void> {
  const { error } = await supabase.from("attachment_photos").update(patch).eq("id", photoId);
  if (error) throw error;
}

export async function deleteDashboardPhoto(photoId: string): Promise<void> {
  const { error } = await supabase.from("attachment_photos").delete().eq("id", photoId);
  if (error) throw error;
}
