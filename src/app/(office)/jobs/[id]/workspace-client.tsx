"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  checkDocumentsSupport,
  deleteDashboardDocument,
  deleteDashboardPhoto,
  listDashboardDocuments,
  listDashboardJobs,
  listDashboardPhotos,
  updateDashboardJob,
  updateDashboardPhoto,
  uploadDashboardDocument,
} from "@/lib/dashboard/provider";
import {
  createOwnerSharePackage,
  getDashboardReportActions,
  listOwnerSharePackages,
  updateOwnerSharePackage,
} from "@/lib/share/provider";
import type {
  DashboardDocument,
  DashboardJob,
  DashboardPhoto,
} from "@/lib/dashboard/types";
import type { OwnerSharePackage } from "@/lib/share/types";

type WorkspaceTab = "overview" | "photos" | "reports" | "documents" | "share" | "crm";
const TAB_LABELS: Record<WorkspaceTab, string> = {
  overview: "Overview",
  photos: "Photos",
  reports: "Reports",
  documents: "Documents",
  share: "Share",
  crm: "CRM",
};

type PhotoTags = {
  structure: string;
  section: string;
  elevation: string;
  component: string;
};
type DamageFilter = "both" | "damaged" | "not_damaged";
type ReportSectionFilter =
  | "all"
  | "exterior"
  | "roof_details"
  | "roof_components"
  | "roof_slopes";

function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value.trim()) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function parseCategoryToTags(category: string | null | undefined): PhotoTags {
  const parts = (category ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    structure: parts[0] ?? "",
    section: parts[1] ?? "",
    elevation: parts[2] ?? "",
    component: parts[3] ?? "",
  };
}

function composeCategoryFromTags(tags: PhotoTags) {
  return [tags.structure, tags.section, tags.elevation, tags.component]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("/");
}

function normalizeDamageDetail(value: string) {
  const cleaned = value
    .trim()
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ");
  return cleaned;
}

function toTitleWord(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function toDisplaySegment(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => toTitleWord(part))
    .join(" ");
}

function hasAnyNumber(value: string) {
  return /\d/.test(value);
}

function valuePathFromTags(tags: PhotoTags) {
  return [tags.structure, tags.section, tags.elevation]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" / ");
}

function valuePathDisplayFromTags(tags: PhotoTags) {
  return [tags.structure, tags.section, tags.elevation]
    .map((value) => toDisplaySegment(value))
    .filter(Boolean)
    .join(" / ");
}

function tagsWithValuePath(currentTags: PhotoTags, valuePath: string): PhotoTags {
  const parts = valuePath
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    ...currentTags,
    structure: parts[0] ?? "",
    section: parts[1] ?? "",
    elevation: parts[2] ?? "",
  };
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveDamageBucket(photo: DashboardPhoto, captionValue?: string, tags?: PhotoTags): DamageFilter {
  const caption = (captionValue ?? photo.caption ?? "").toLowerCase();
  if (caption.includes("mechanical")) return "not_damaged";
  if (caption.includes("no damage")) return "not_damaged";
  if (caption.includes("damage")) return "damaged";
  const detail = normalizeDamageDetail(tags?.component ?? "");
  return detail ? "damaged" : "not_damaged";
}

function damageDetailDisplay(photo: DashboardPhoto, captionValue?: string, tags?: PhotoTags) {
  const condition = resolveDamageBucket(photo, captionValue, tags);
  if (condition !== "damaged") return "N/A";

  const caption = (captionValue ?? photo.caption ?? "").toLowerCase();
  const detailRaw = normalizeDamageDetail(tags?.component ?? "");
  const detail = toDisplaySegment(detailRaw);
  const mentionsCountType =
    caption.includes("wind") ||
    caption.includes("tree") ||
    caption.includes("hail") ||
    caption.includes("other");
  const detailLooksGeneric =
    detailRaw === "damage-count" ||
    detailRaw === "damage counts" ||
    detailRaw === "damage-counts" ||
    detailRaw === "damages";

  if (mentionsCountType && !hasAnyNumber(`${caption} ${detailRaw}`)) return "N/A";
  if (!detailRaw || detailLooksGeneric) return "N/A";
  return detail;
}

function matchesReportSection(tags: PhotoTags, filter: ReportSectionFilter) {
  if (filter === "all") return true;
  const text = [tags.structure, tags.section, tags.elevation].join(" ").toLowerCase();
  if (filter === "exterior") return text.includes("exterior");
  if (filter === "roof_details") return text.includes("roof") && text.includes("detail");
  if (filter === "roof_components") return text.includes("roof") && text.includes("component");
  if (filter === "roof_slopes") return text.includes("roof") && text.includes("slope");
  return true;
}

export function JobWorkspaceClient({ jobId }: { jobId: string }) {
  const [tab, setTab] = useState<WorkspaceTab>("overview");

  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<DashboardPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [savingPhotoId, setSavingPhotoId] = useState("");
  const [deletingPhotoId, setDeletingPhotoId] = useState("");
  const [activeLightboxIndex, setActiveLightboxIndex] = useState(-1);
  const [filters, setFilters] = useState<PhotoTags>({
    structure: "",
    section: "",
    elevation: "",
    component: "",
  });
  const [damageFilter, setDamageFilter] = useState<DamageFilter>("both");
  const [reportSectionFilter, setReportSectionFilter] = useState<ReportSectionFilter>("all");
  const [editCaption, setEditCaption] = useState<Record<string, string>>({});
  const [editTags, setEditTags] = useState<Record<string, PhotoTags>>({});

  const [savingJob, setSavingJob] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: "",
    address: "",
    status: "",
    notes: "",
  });

  const [shareLinks, setShareLinks] = useState<OwnerSharePackage[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCreating, setShareCreating] = useState(false);
  const [shareSavingToken, setShareSavingToken] = useState("");
  const [copiedToken, setCopiedToken] = useState("");

  const [reportActions, setReportActions] = useState<{
    reportUrl: string | null;
    shareUrl: string | null;
  }>({ reportUrl: null, shareUrl: null });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [documentsSupported, setDocumentsSupported] = useState<boolean | null>(null);
  const [documents, setDocuments] = useState<DashboardDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState("");

  const selectedJob = useMemo(
    () => jobs.find((candidate) => candidate.id === jobId) ?? null,
    [jobId, jobs]
  );

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      const tags = editTags[photo.id] ?? parseCategoryToTags(photo.category);
      return (
        matchesReportSection(tags, reportSectionFilter) &&
        (!filters.structure || tags.structure === filters.structure) &&
        (!filters.section || tags.section === filters.section) &&
        (damageFilter === "both" ||
          resolveDamageBucket(photo, editCaption[photo.id], tags) === damageFilter)
      );
    });
  }, [
    damageFilter,
    editCaption,
    editTags,
    filters.section,
    filters.structure,
    photos,
    reportSectionFilter,
  ]);

  const filterOptions = useMemo(() => {
    const build = (extractor: (tags: PhotoTags) => string) => {
      const values = new Set<string>();
      photos.forEach((photo) => {
        const tags = editTags[photo.id] ?? parseCategoryToTags(photo.category);
        const value = extractor(tags).trim();
        if (value) values.add(value);
      });
      return [...values].sort((a, b) => a.localeCompare(b));
    };
    return {
      structure: build((tags) => tags.structure),
      section: build((tags) => tags.section),
      elevation: build((tags) => tags.elevation),
      component: build((tags) => tags.component),
    };
  }, [editTags, photos]);

  const activeLightboxPhoto =
    activeLightboxIndex >= 0 ? filteredPhotos[activeLightboxIndex] ?? null : null;

  const refreshJobs = async () => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      setJobs(await listDashboardJobs());
    } catch (error) {
      setJobsError((error as Error)?.message ?? "Unable to load jobs.");
    } finally {
      setJobsLoading(false);
    }
  };

  const refreshPhotos = async () => {
    if (!jobId) return;
    setPhotosLoading(true);
    setPhotosError(null);
    try {
      const nextPhotos = await listDashboardPhotos(jobId);
      setPhotos(nextPhotos);
      const nextCaption: Record<string, string> = {};
      const nextTags: Record<string, PhotoTags> = {};
      nextPhotos.forEach((photo) => {
        nextCaption[photo.id] = photo.caption ?? "";
        nextTags[photo.id] = parseCategoryToTags(photo.category);
      });
      setEditCaption(nextCaption);
      setEditTags(nextTags);
      setActiveLightboxIndex(-1);
    } catch (error) {
      setPhotosError((error as Error)?.message ?? "Unable to load photos.");
    } finally {
      setPhotosLoading(false);
    }
  };

  const refreshShareLinks = async () => {
    if (!jobId) return;
    setShareLoading(true);
    setShareError(null);
    try {
      setShareLinks(await listOwnerSharePackages(jobId));
    } catch (error) {
      setShareError((error as Error)?.message ?? "Unable to load share links.");
      setShareLinks([]);
    } finally {
      setShareLoading(false);
    }
  };

  const refreshReportActions = async () => {
    if (!jobId) return;
    setReportLoading(true);
    setReportError(null);
    try {
      setReportActions(await getDashboardReportActions(jobId));
    } catch (error) {
      setReportError((error as Error)?.message ?? "Unable to load report actions.");
      setReportActions({ reportUrl: null, shareUrl: null });
    } finally {
      setReportLoading(false);
    }
  };

  const refreshDocuments = async () => {
    if (!jobId) return;
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      setDocuments(await listDashboardDocuments(jobId));
    } catch (error) {
      setDocumentsError((error as Error)?.message ?? "Unable to load documents.");
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    void refreshJobs();
  }, []);

  useEffect(() => {
    if (!selectedJob) {
      setJobForm({ title: "", address: "", status: "", notes: "" });
      return;
    }
    setJobForm({
      title: selectedJob.title ?? "",
      address: selectedJob.address ?? "",
      status: selectedJob.status ?? "",
      notes: selectedJob.notes ?? "",
    });
  }, [selectedJob]);

  useEffect(() => {
    if (!jobId) return;
    void refreshPhotos();
    void refreshShareLinks();
    void refreshReportActions();
    void checkDocumentsSupport().then((supported) => {
      setDocumentsSupported(supported);
      if (supported) void refreshDocuments();
    });
  }, [jobId]);

  const handleSaveJob = async () => {
    if (!jobId) return;
    setSavingJob(true);
    try {
      await updateDashboardJob(jobId, {
        title: jobForm.title.trim() || "Untitled job",
        address: jobForm.address.trim() || "Address pending",
        status: jobForm.status.trim() || null,
        notes: jobForm.notes.trim() || null,
      });
      await refreshJobs();
    } catch (error) {
      window.alert((error as Error)?.message ?? "Unable to save job details.");
    } finally {
      setSavingJob(false);
    }
  };

  const handleSavePhoto = async (photo: DashboardPhoto) => {
    setSavingPhotoId(photo.id);
    try {
      const nextTags = editTags[photo.id] ?? parseCategoryToTags(photo.category);
      const normalizedDamage = normalizeDamageDetail(nextTags.component);
      const nextCategory = composeCategoryFromTags(
        { ...nextTags, component: normalizedDamage }
      );
      await updateDashboardPhoto(photo.id, {
        caption: (editCaption[photo.id] ?? "").trim() || null,
        category: nextCategory || null,
      });
      await refreshPhotos();
    } catch (error) {
      window.alert((error as Error)?.message ?? "Unable to save photo metadata.");
    } finally {
      setSavingPhotoId("");
    }
  };

  const handleDeletePhoto = async (photo: DashboardPhoto) => {
    if (!window.confirm("Delete this photo? This cannot be undone.")) return;
    setDeletingPhotoId(photo.id);
    try {
      await deleteDashboardPhoto({ id: photo.id, storagePath: photo.storage_path });
      await refreshPhotos();
    } catch (error) {
      window.alert((error as Error)?.message ?? "Unable to delete photo.");
    } finally {
      setDeletingPhotoId("");
    }
  };

  const handleCreateShareLink = async () => {
    if (!selectedJob) return;
    setShareCreating(true);
    try {
      await createOwnerSharePackage({
        primaryJobId: selectedJob.id,
        title: `${selectedJob.title} - Shared Package`,
        address: selectedJob.address,
        expiresInDays: 30,
      });
      await refreshShareLinks();
      await refreshReportActions();
    } catch (error) {
      window.alert((error as Error)?.message ?? "Unable to create share link.");
    } finally {
      setShareCreating(false);
    }
  };

  const handleSaveShareLink = async (
    token: string,
    patch: { isRevoked?: boolean; allowDownload?: boolean; expiresAt?: string }
  ) => {
    setShareSavingToken(token);
    try {
      await updateOwnerSharePackage(token, patch);
      await refreshShareLinks();
      await refreshReportActions();
    } catch (error) {
      window.alert((error as Error)?.message ?? "Unable to update share link.");
    } finally {
      setShareSavingToken("");
    }
  };

  const handleCopyShareLink = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken(""), 1800);
    } catch {
      window.alert("Unable to copy link on this browser.");
    }
  };

  const handleUploadDocument = async (file: File | null) => {
    if (!file || !jobId || !documentsSupported) return;
    setUploadingDocument(true);
    try {
      await uploadDashboardDocument({ jobId, file });
      await refreshDocuments();
    } catch (error) {
      window.alert((error as Error)?.message ?? "Unable to upload document.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (document: DashboardDocument) => {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    setDeletingDocumentId(document.id);
    try {
      await deleteDashboardDocument({
        id: document.id,
        storagePath: document.storage_path,
      });
      await refreshDocuments();
    } catch (error) {
      window.alert((error as Error)?.message ?? "Unable to delete document.");
    } finally {
      setDeletingDocumentId("");
    }
  };

  if (!jobId) {
    return (
      <section className="office-page">
        <p className="dashboard-error">Job id is missing.</p>
      </section>
    );
  }

  return (
    <section className="office-page job-workspace-page">
      <div className="office-page-header job-workspace-header">
        <div>
          <h3>{selectedJob?.title ?? "Job Workspace"}</h3>
          <p className="muted">{selectedJob?.address ?? "Loading job details..."}</p>
        </div>
        <div className="office-topbar-actions job-workspace-actions">
          <Link href="/jobs" className="btn btn-secondary">
            Back to Jobs
          </Link>
          <button className="btn btn-secondary" onClick={() => void refreshJobs()}>
            Refresh
          </button>
        </div>
      </div>

      {jobsLoading ? <p className="muted">Loading job...</p> : null}
      {jobsError ? <p className="dashboard-error">{jobsError}</p> : null}

      {selectedJob ? (
        <>
          <div className="office-tabs" role="tablist" aria-label="Job workspace sections">
            {(["overview", "photos", "reports", "documents", "share", "crm"] as WorkspaceTab[]).map(
              (nextTab) => (
              <button
                key={nextTab}
                className={`office-tab ${tab === nextTab ? "active" : ""}`}
                onClick={() => setTab(nextTab)}
                role="tab"
                aria-selected={tab === nextTab}
                aria-controls={`${nextTab}-panel`}
              >
                {TAB_LABELS[nextTab]}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <section className="job-tab-panel" id="overview-panel" role="tabpanel">
              <div className="job-tab-header">
                <h4>Overview</h4>
                <p className="muted">Key job metadata and timeline at a glance.</p>
              </div>
              <div className="office-section-grid">
                <article className="card">
                  <h4>Job Info</h4>
                  <dl className="job-meta-list">
                    <div className="job-meta-row">
                      <dt>Title</dt>
                      <dd>{selectedJob.title}</dd>
                    </div>
                    <div className="job-meta-row">
                      <dt>Address</dt>
                      <dd>{selectedJob.address}</dd>
                    </div>
                    <div className="job-meta-row">
                      <dt>Status</dt>
                      <dd>{selectedJob.status ?? "scheduled"}</dd>
                    </div>
                    <div className="job-meta-row">
                      <dt>Notes</dt>
                      <dd>{selectedJob.notes ?? "—"}</dd>
                    </div>
                  </dl>
                </article>
                <article className="card">
                  <h4>Timeline</h4>
                  <dl className="job-meta-list">
                    <div className="job-meta-row">
                      <dt>Scheduled</dt>
                      <dd>
                        {formatShortDateTime(selectedJob.scheduled_at) ?? "Not scheduled"}
                      </dd>
                    </div>
                    <div className="job-meta-row">
                      <dt>Updated</dt>
                      <dd>
                        {formatShortDateTime(selectedJob.updated_at) ?? "Unknown"}
                      </dd>
                    </div>
                    <div className="job-meta-row">
                      <dt>Photos</dt>
                      <dd>{photos.length}</dd>
                    </div>
                    <div className="job-meta-row">
                      <dt>Share Links</dt>
                      <dd>{shareLinks.length}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            </section>
          ) : null}

          {tab === "crm" ? (
            <section className="job-tab-panel" id="crm-panel" role="tabpanel">
              <div className="job-tab-header">
                <h4>CRM</h4>
                <p className="muted">Lightweight, job-focused updates for office follow-up.</p>
              </div>
              <div className="dashboard-panel">
                <div className="dashboard-job-editor">
                  <div className="job-form-grid">
                    <label className="job-form-field">
                      <span className="job-form-label">Job Title</span>
                      <input
                        className="input"
                        placeholder="Job title"
                        value={jobForm.title}
                        onChange={(event) =>
                          setJobForm((prev) => ({ ...prev, title: event.target.value }))
                        }
                      />
                    </label>
                    <label className="job-form-field">
                      <span className="job-form-label">Property Address</span>
                      <input
                        className="input"
                        placeholder="Property address"
                        value={jobForm.address}
                        onChange={(event) =>
                          setJobForm((prev) => ({ ...prev, address: event.target.value }))
                        }
                      />
                    </label>
                    <label className="job-form-field">
                      <span className="job-form-label">Status</span>
                      <input
                        className="input"
                        placeholder="Status"
                        value={jobForm.status}
                        onChange={(event) =>
                          setJobForm((prev) => ({ ...prev, status: event.target.value }))
                        }
                      />
                    </label>
                    <label className="job-form-field job-form-field-full">
                      <span className="job-form-label">Notes</span>
                      <textarea
                        className="input dashboard-notes-input"
                        placeholder="Notes"
                        value={jobForm.notes}
                        onChange={(event) =>
                          setJobForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="job-primary-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => void handleSaveJob()}
                      disabled={savingJob}
                    >
                      {savingJob ? "Saving..." : "Save Job Updates"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {tab === "reports" ? (
            <section className="job-tab-panel" id="reports-panel" role="tabpanel">
              <div className="job-tab-header">
                <h4>Reports</h4>
                <p className="muted">View and download generated report output.</p>
              </div>
              <div className="dashboard-share-panel">
                <div className="dashboard-share-header">
                  <h3>Report Actions</h3>
                  <p className="muted">
                    Status: {reportActions.reportUrl ? "Ready" : reportLoading ? "Preparing" : "Pending"}
                  </p>
                </div>
                <div className="dashboard-share-row job-primary-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      reportActions.reportUrl && window.open(reportActions.reportUrl, "_blank")
                    }
                    disabled={!reportActions.reportUrl || reportLoading}
                  >
                    View Report
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!reportActions.reportUrl) return;
                      const link = document.createElement("a");
                      link.href = reportActions.reportUrl;
                      link.download = "";
                      link.click();
                    }}
                    disabled={!reportActions.reportUrl || reportLoading}
                  >
                    Download PDF
                  </button>
                </div>
                {reportLoading ? <p className="muted">Checking report availability...</p> : null}
                {reportError ? <p className="dashboard-error">{reportError}</p> : null}
              </div>
            </section>
          ) : null}

          {tab === "share" ? (
            <section className="job-tab-panel" id="share-panel" role="tabpanel">
              <div className="job-tab-header">
                <h4>Share</h4>
                <p className="muted">Create, copy, and manage external share access.</p>
              </div>
              <div className="dashboard-share-panel">
                <div className="dashboard-share-header">
                  <h3>Share Links</h3>
                  <button
                    className="btn btn-secondary"
                    onClick={() => void handleCreateShareLink()}
                    disabled={shareCreating}
                  >
                    {shareCreating ? "Creating..." : "Create Link"}
                  </button>
                </div>
                {shareLoading ? <p className="muted">Loading share links...</p> : null}
                {shareError ? <p className="dashboard-error">{shareError}</p> : null}
                <div className="dashboard-share-list">
                  {shareLinks.map((link) => (
                    <div key={link.token} className="dashboard-share-item">
                      <div className="dashboard-share-row">
                        <strong>{link.title}</strong>
                        <div className="dashboard-share-actions">
                          <a href={link.url} target="_blank" rel="noreferrer" className="muted">
                            Open
                          </a>
                          <button
                            className="btn btn-secondary dashboard-inline-btn"
                            onClick={() => void handleCopyShareLink(link.url, link.token)}
                          >
                            {copiedToken === link.token ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                      <p className="muted">
                        Expires: {formatShortDateTime(link.expiresAt) ?? "Unknown"}
                      </p>
                      <div className="dashboard-share-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={!link.isRevoked}
                            onChange={(event) =>
                              void handleSaveShareLink(link.token, {
                                isRevoked: !event.target.checked,
                              })
                            }
                            disabled={shareSavingToken === link.token}
                          />{" "}
                          Active
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={link.allowDownload}
                            onChange={(event) =>
                              void handleSaveShareLink(link.token, {
                                allowDownload: event.target.checked,
                              })
                            }
                            disabled={shareSavingToken === link.token}
                          />{" "}
                          Allow downloads
                        </label>
                      </div>
                      <div className="dashboard-share-row">
                        <input
                          className="input"
                          type="datetime-local"
                          value={toLocalDateTimeInput(link.expiresAt)}
                          onChange={(event) => {
                            const nextIso = toIsoOrNull(event.target.value);
                            if (!nextIso) return;
                            void handleSaveShareLink(link.token, { expiresAt: nextIso });
                          }}
                          disabled={shareSavingToken === link.token}
                        />
                      </div>
                    </div>
                  ))}
                  {!shareLinks.length && !shareLoading ? (
                    <p className="muted">No share links for this job.</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {tab === "documents" ? (
            <section className="job-tab-panel" id="documents-panel" role="tabpanel">
              <div className="job-tab-header">
                <h4>Documents</h4>
                <p className="muted">Office file storage for this job record.</p>
              </div>
              <div className="dashboard-panel">
                {documentsSupported === null ? <p className="muted">Checking support...</p> : null}
                {documentsSupported === false ? (
                  <p className="muted">Document storage is not enabled for this workspace yet.</p>
                ) : null}
                {documentsSupported ? (
                  <>
                    <div className="dashboard-share-row">
                      <input
                        type="file"
                        onChange={(event) =>
                          void handleUploadDocument(event.target.files?.[0] ?? null)
                        }
                        disabled={uploadingDocument}
                      />
                      {uploadingDocument ? <p className="muted">Uploading...</p> : null}
                    </div>
                    {documentsLoading ? <p className="muted">Loading documents...</p> : null}
                    {documentsError ? <p className="dashboard-error">{documentsError}</p> : null}
                    <div className="office-list">
                      {documents.map((doc) => (
                        <div key={doc.id} className="office-list-row">
                          <strong>{doc.file_name}</strong>
                          <small>
                            {formatShortDateTime(doc.created_at) ?? "Unknown date"}
                          </small>
                          <div className="dashboard-share-actions">
                            {doc.signed_url ? (
                              <a href={doc.signed_url} className="muted" target="_blank" rel="noreferrer">
                                Download
                              </a>
                            ) : null}
                            <button
                              className="btn btn-secondary dashboard-inline-btn"
                              onClick={() => void handleDeleteDocument(doc)}
                              disabled={deletingDocumentId === doc.id}
                            >
                              {deletingDocumentId === doc.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                      {!documents.length && !documentsLoading ? (
                        <p className="muted">No documents uploaded.</p>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {tab === "photos" ? (
            <section className="job-tab-panel" id="photos-panel" role="tabpanel">
              <div className="job-photos-subhead">
                <h4>Photo Gallery</h4>
                <p className="muted">Filter, relabel, and manage captured photos.</p>
              </div>
              <div className="dashboard-filter-row">
                <select
                  className="input"
                  value={reportSectionFilter}
                  onChange={(event) =>
                    setReportSectionFilter(event.target.value as ReportSectionFilter)
                  }
                >
                  <option value="all">All Report Sections</option>
                  <option value="exterior">Exterior</option>
                  <option value="roof_details">Roof Details</option>
                  <option value="roof_components">Roof Components</option>
                  <option value="roof_slopes">Roof Slopes</option>
                </select>
                <select
                  className="input"
                  value={filters.structure}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, structure: event.target.value }))
                  }
                >
                  <option value="">All Structures</option>
                  {filterOptions.structure.map((option) => (
                    <option key={option} value={option}>
                      {toDisplaySegment(option)}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={filters.section}
                  onChange={(event) => setFilters((prev) => ({ ...prev, section: event.target.value }))}
                >
                  <option value="">All Sections</option>
                  {filterOptions.section.map((option) => (
                    <option key={option} value={option}>
                      {toDisplaySegment(option)}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={damageFilter}
                  onChange={(event) => setDamageFilter(event.target.value as DamageFilter)}
                >
                  <option value="both">All Damage</option>
                  <option value="damaged">Damaged</option>
                  <option value="not_damaged">Not Damaged</option>
                </select>
              </div>

              {photosLoading ? <p className="muted">Loading photos...</p> : null}
              {photosError ? <p className="dashboard-error">{photosError}</p> : null}
              <div className="dashboard-photo-grid">
                {filteredPhotos.map((photo, idx) => (
                  <article key={photo.id} className="dashboard-photo-card">
                    {photo.signed_url ? (
                      <img
                        src={photo.signed_url}
                        alt={photo.caption ?? "Job photo"}
                        loading="lazy"
                        onClick={() => setActiveLightboxIndex(idx)}
                      />
                    ) : (
                      <div className="dashboard-photo-placeholder">No preview URL</div>
                    )}
                    <div className="dashboard-photo-meta">
                      <p className="job-photo-stamp muted">
                        Captured:{" "}
                        {formatShortDateTime(photo.created_at) ?? "Unknown"}
                      </p>
                      <label className="job-photo-field-label" htmlFor={`photo-description-${photo.id}`}>
                        Description
                      </label>
                      <input
                        id={`photo-description-${photo.id}`}
                        className="input job-photo-input"
                        placeholder="Description"
                        value={editCaption[photo.id] ?? ""}
                        onChange={(event) =>
                          setEditCaption((prev) => ({ ...prev, [photo.id]: event.target.value }))
                        }
                      />
                      <label className="job-photo-field-label" htmlFor={`photo-value-path-${photo.id}`}>
                        Location
                      </label>
                      <input
                        id={`photo-value-path-${photo.id}`}
                        className="input job-photo-input"
                        placeholder="Exterior / Front / Downspout"
                        value={valuePathDisplayFromTags(
                          editTags[photo.id] ?? parseCategoryToTags(photo.category)
                        )}
                        onChange={(event) =>
                          setEditTags((prev) => ({
                            ...prev,
                            [photo.id]: tagsWithValuePath(
                              prev[photo.id] ?? parseCategoryToTags(photo.category),
                              event.target.value
                            ),
                          }))
                        }
                      />
                      <p className="job-photo-format-note muted">
                        Damage Detail:{" "}
                        {damageDetailDisplay(
                          photo,
                          editCaption[photo.id],
                          editTags[photo.id] ?? parseCategoryToTags(photo.category)
                        )}
                      </p>
                      <div className="job-photo-tag-summary">
                        <span className="muted">
                          {valuePathDisplayFromTags(
                            editTags[photo.id] ?? parseCategoryToTags(photo.category)
                          ) ||
                            "Unassigned"}
                        </span>
                      </div>
                      <div className="dashboard-share-actions">
                        <button
                          className="btn btn-primary"
                          onClick={() => void handleSavePhoto(photo)}
                          disabled={savingPhotoId === photo.id}
                        >
                          {savingPhotoId === photo.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => void handleDeletePhoto(photo)}
                          disabled={deletingPhotoId === photo.id}
                        >
                          {deletingPhotoId === photo.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {!filteredPhotos.length && !photosLoading ? (
                  <p className="muted">No photos match current filters.</p>
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="dashboard-error">Job not found.</p>
      )}

      {activeLightboxPhoto && activeLightboxPhoto.signed_url ? (
        <div
          className="lightbox-overlay"
          onClick={() => setActiveLightboxIndex(-1)}
          role="button"
          tabIndex={0}
        >
          <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
            <img src={activeLightboxPhoto.signed_url} alt="Enlarged photo" />
            <div className="lightbox-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setActiveLightboxIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeLightboxIndex <= 0}
              >
                Prev
              </button>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setActiveLightboxIndex((prev) => Math.min(filteredPhotos.length - 1, prev + 1))
                }
                disabled={activeLightboxIndex >= filteredPhotos.length - 1}
              >
                Next
              </button>
              <button className="btn btn-primary" onClick={() => setActiveLightboxIndex(-1)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
