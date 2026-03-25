"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  deleteDashboardPhoto,
  listDashboardJobs,
  listDashboardPhotos,
  updateDashboardJob,
  updateDashboardPhoto,
} from "@/lib/dashboard/provider";
import {
  createOwnerSharePackage,
  getDashboardReportActions,
  listOwnerSharePackages,
  updateOwnerSharePackage,
} from "@/lib/share/provider";
import type { DashboardJob, DashboardPhoto } from "@/lib/dashboard/types";
import type { OwnerSharePackage } from "@/lib/share/types";

type SessionUser = { id: string; email: string | null };

type PhotoTags = {
  structure: string;
  section: string;
  elevation: string;
  component: string;
};

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

export function DashboardClient() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobSearch, setJobSearch] = useState("");

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

  const filteredJobs = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();
    if (!query) return jobs;
    return jobs.filter((job) =>
      [job.title, job.address, job.status ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [jobs, jobSearch]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      const tags = editTags[photo.id] ?? parseCategoryToTags(photo.category);
      return (
        (!filters.structure || tags.structure === filters.structure) &&
        (!filters.section || tags.section === filters.section) &&
        (!filters.elevation || tags.elevation === filters.elevation) &&
        (!filters.component || tags.component === filters.component)
      );
    });
  }, [photos, editTags, filters]);

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
  }, [photos, editTags]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sessionUser = data.session?.user ?? null;
      setUser(
        sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null
      );
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  const refreshJobs = async () => {
    if (!user) return;
    setJobsLoading(true);
    setJobsError(null);
    try {
      const nextJobs = await listDashboardJobs();
      setJobs(nextJobs);
      setSelectedJobId((prev) => {
        if (!prev) return nextJobs[0]?.id || "";
        if (nextJobs.some((job) => job.id === prev)) return prev;
        return nextJobs[0]?.id || "";
      });
    } catch (error) {
      setJobsError((error as Error)?.message ?? "Unable to load jobs.");
    } finally {
      setJobsLoading(false);
    }
  };

  const refreshPhotos = async (jobId: string) => {
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

  const refreshShareLinks = async (jobId: string) => {
    if (!jobId) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const links = await listOwnerSharePackages(jobId);
      setShareLinks(links);
    } catch (error) {
      setShareError((error as Error)?.message ?? "Unable to load share links.");
      setShareLinks([]);
    } finally {
      setShareLoading(false);
    }
  };

  const refreshReportActions = async (jobId: string) => {
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

  useEffect(() => {
    if (!user) return;
    void refreshJobs();
  }, [user]);

  useEffect(() => {
    if (!selectedJobId) return;
    void refreshPhotos(selectedJobId);
    void refreshShareLinks(selectedJobId);
    void refreshReportActions(selectedJobId);
  }, [selectedJobId]);

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

  const handleSaveJob = async () => {
    if (!selectedJobId) return;
    setSavingJob(true);
    try {
      await updateDashboardJob(selectedJobId, {
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
      const nextCategory = composeCategoryFromTags(editTags[photo.id] ?? parseCategoryToTags(photo.category));
      await updateDashboardPhoto(photo.id, {
        caption: (editCaption[photo.id] ?? "").trim() || null,
        category: nextCategory || null,
      });
      await refreshPhotos(selectedJobId);
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
      await refreshPhotos(selectedJobId);
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
      await refreshShareLinks(selectedJob.id);
      await refreshReportActions(selectedJob.id);
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
      if (selectedJobId) {
        await refreshShareLinks(selectedJobId);
        await refreshReportActions(selectedJobId);
      }
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

  const activeLightboxPhoto =
    activeLightboxIndex >= 0 ? filteredPhotos[activeLightboxIndex] ?? null : null;

  if (authLoading || !user) {
    return (
      <main className="page">
        <section className="dashboard-auth-wrap">
          <div className="dashboard-auth-card">
            <p className="muted">Loading dashboard...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="dashboard-wrap">
        <header className="dashboard-top">
          <div>
            <p className="eyebrow">ProScope Office</p>
            <h1>Web Dashboard</h1>
            <p className="muted">Logged in as {user.email ?? "ProScope user"}.</p>
          </div>
          <div className="dashboard-top-actions">
            <button className="btn btn-secondary" onClick={() => void refreshJobs()}>
              Refresh Jobs
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                void supabase.auth.signOut().then(() => router.replace("/login"));
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        <div className="dashboard-grid">
          <aside className="dashboard-panel">
            <h2>Jobs</h2>
            <input
              className="input dashboard-search-input"
              placeholder="Search jobs by title, address, or status"
              value={jobSearch}
              onChange={(event) => setJobSearch(event.target.value)}
            />
            {jobsLoading ? <p className="muted">Loading jobs...</p> : null}
            {jobsError ? <p className="dashboard-error">{jobsError}</p> : null}
            <div className="dashboard-job-list">
              {filteredJobs.map((job) => (
                <button
                  key={job.id}
                  className={`dashboard-job-item ${job.id === selectedJobId ? "active" : ""}`}
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <strong>{job.title}</strong>
                  <span>{job.address}</span>
                  <small>{job.status ?? "scheduled"}</small>
                </button>
              ))}
              {!filteredJobs.length && !jobsLoading ? (
                <p className="muted">No matching jobs.</p>
              ) : null}
            </div>
          </aside>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2>Job Detail</h2>
              {selectedJob ? (
                <p className="muted">{selectedJob.title} - {selectedJob.address}</p>
              ) : (
                <p className="muted">Select a job to review.</p>
              )}
            </div>

            {selectedJob ? (
              <div className="dashboard-job-editor">
                <input
                  className="input"
                  placeholder="Job title"
                  value={jobForm.title}
                  onChange={(event) =>
                    setJobForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
                <input
                  className="input"
                  placeholder="Property address"
                  value={jobForm.address}
                  onChange={(event) =>
                    setJobForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                />
                <input
                  className="input"
                  placeholder="Status"
                  value={jobForm.status}
                  onChange={(event) =>
                    setJobForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                />
                <textarea
                  className="input dashboard-notes-input"
                  placeholder="Notes"
                  value={jobForm.notes}
                  onChange={(event) =>
                    setJobForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
                <button className="btn btn-primary" onClick={() => void handleSaveJob()} disabled={savingJob}>
                  {savingJob ? "Saving..." : "Save Job Details"}
                </button>
              </div>
            ) : null}

            {selectedJob ? (
              <div className="dashboard-share-panel">
                <div className="dashboard-share-header">
                  <h3>Report Actions</h3>
                </div>
                <div className="dashboard-share-row">
                  <button
                    className="btn btn-secondary"
                    onClick={() => reportActions.reportUrl && window.open(reportActions.reportUrl, "_blank")}
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
                  <button
                    className="btn btn-secondary"
                    onClick={() => reportActions.shareUrl && window.open(reportActions.shareUrl, "_blank")}
                    disabled={!reportActions.shareUrl || reportLoading}
                  >
                    Open Share Link
                  </button>
                </div>
                {reportLoading ? <p className="muted">Checking report availability...</p> : null}
                {reportError ? <p className="dashboard-error">{reportError}</p> : null}
              </div>
            ) : null}

            {selectedJob ? (
              <div className="dashboard-share-panel">
                <div className="dashboard-share-header">
                  <h3>Share Links</h3>
                  <button className="btn btn-secondary" onClick={() => void handleCreateShareLink()} disabled={shareCreating}>
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
                      <p className="muted">Expires: {new Date(link.expiresAt).toLocaleString()}</p>
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
                </div>
              </div>
            ) : null}

            <div className="dashboard-filter-row">
              <select
                className="input"
                value={filters.structure}
                onChange={(event) => setFilters((prev) => ({ ...prev, structure: event.target.value }))}
              >
                <option value="">All structures</option>
                {filterOptions.structure.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={filters.section}
                onChange={(event) => setFilters((prev) => ({ ...prev, section: event.target.value }))}
              >
                <option value="">All sections</option>
                {filterOptions.section.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={filters.elevation}
                onChange={(event) => setFilters((prev) => ({ ...prev, elevation: event.target.value }))}
              >
                <option value="">All elevations/slopes</option>
                {filterOptions.elevation.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={filters.component}
                onChange={(event) => setFilters((prev) => ({ ...prev, component: event.target.value }))}
              >
                <option value="">All components</option>
                {filterOptions.component.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
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
                    <input
                      className="input"
                      placeholder="Caption"
                      value={editCaption[photo.id] ?? ""}
                      onChange={(event) =>
                        setEditCaption((prev) => ({ ...prev, [photo.id]: event.target.value }))
                      }
                    />
                    <div className="dashboard-filter-row">
                      <input
                        className="input"
                        placeholder="Structure"
                        value={editTags[photo.id]?.structure ?? ""}
                        onChange={(event) =>
                          setEditTags((prev) => ({
                            ...prev,
                            [photo.id]: { ...(prev[photo.id] ?? parseCategoryToTags(photo.category)), structure: event.target.value },
                          }))
                        }
                      />
                      <input
                        className="input"
                        placeholder="Section"
                        value={editTags[photo.id]?.section ?? ""}
                        onChange={(event) =>
                          setEditTags((prev) => ({
                            ...prev,
                            [photo.id]: { ...(prev[photo.id] ?? parseCategoryToTags(photo.category)), section: event.target.value },
                          }))
                        }
                      />
                      <input
                        className="input"
                        placeholder="Elevation/Slope"
                        value={editTags[photo.id]?.elevation ?? ""}
                        onChange={(event) =>
                          setEditTags((prev) => ({
                            ...prev,
                            [photo.id]: { ...(prev[photo.id] ?? parseCategoryToTags(photo.category)), elevation: event.target.value },
                          }))
                        }
                      />
                      <input
                        className="input"
                        placeholder="Component"
                        value={editTags[photo.id]?.component ?? ""}
                        onChange={(event) =>
                          setEditTags((prev) => ({
                            ...prev,
                            [photo.id]: { ...(prev[photo.id] ?? parseCategoryToTags(photo.category)), component: event.target.value },
                          }))
                        }
                      />
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
        </div>
      </section>

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
                  setActiveLightboxIndex((prev) =>
                    Math.min(filteredPhotos.length - 1, prev + 1)
                  )
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
    </main>
  );
}
