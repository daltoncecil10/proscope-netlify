export type DashboardJobStatus = "ready" | "draft" | "in_progress" | "scheduled";

export type DashboardJob = {
  id: string;
  title: string;
  address: string;
  status: DashboardJobStatus;
  inspectedAt: string | null;
  inspectorName: string;
  inspectorInitials: string;
  inspectorColor: string;
  assigneeName: string;
  photoCount: number;
  expiresAt: string | null;
  pdfSizeBytes: number | null;
  pdfUrl: string | null;
  shareUrl: string | null;
  scheduledFor: string | null;
  rawStatus: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DashboardPhoto = {
  id: string;
  job_id: string;
  caption: string | null;
  category: string | null;
  signed_url: string | null;
  created_at: string | null;
};

export type DashboardFilter =
  | "all"
  | "ready"
  | "in_progress"
  | "drafts"
  | "scheduled"
  | "expiring_soon"
  | "trash";

export type ExpiresUrgency = "normal" | "warn" | "urgent";
