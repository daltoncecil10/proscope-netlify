"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveDashboardJob,
  checkDashboardJobCreateSupport,
  listDashboardJobs,
  listDashboardPhotos,
  updateDashboardJob,
} from "@/lib/dashboard/provider";
import type { DashboardJob } from "@/lib/dashboard/types";
import {
  getDashboardReportActions,
  listOwnerSharePackages,
} from "@/lib/share/provider";

type SortKey = "scheduled_soonest" | "updated_at" | "title";
type DatePreset = "all" | "today" | "next7" | "past" | "custom";
type RowUrgency = "today" | "upcoming" | "overdue" | "unscheduled";
type QuickFilter = "" | "past_due" | "pending_review" | "issues";

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "scheduled").trim().toLowerCase();
}

function toStartOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toEndOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toUrgency(job: DashboardJob): RowUrgency {
  if (!job.scheduled_at) return "unscheduled";
  const when = new Date(job.scheduled_at);
  if (!Number.isFinite(when.getTime())) return "unscheduled";
  const now = new Date();
  const todayStart = toStartOfDay(now);
  const todayEnd = toEndOfDay(now);
  const upcomingEnd = toEndOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  if (when >= todayStart && when <= todayEnd) return "today";
  if (when > todayEnd && when <= upcomingEnd) return "upcoming";
  if (when < todayStart) return "overdue";
  return "unscheduled";
}

function getAssignee(job: DashboardJob): string | null {
  const dynamic = job as DashboardJob & Record<string, unknown>;
  const candidates = [
    dynamic.assignee,
    dynamic.assignee_name,
    dynamic.technician,
    dynamic.technician_name,
    dynamic.assigned_to_name,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function cityStateFromAddress(address: string | null | undefined) {
  const value = (address ?? "").trim();
  if (!value) return "Location not set";
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  return value;
}

function formatSchedule(value: string | null) {
  if (!value) return "Not scheduled";
  const when = new Date(value);
  if (!Number.isFinite(when.getTime())) return "Invalid date";
  return when.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateInputDefault(value: string | null) {
  if (!value) return "";
  const when = new Date(value);
  if (!Number.isFinite(when.getTime())) return "";
  return new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function JobsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const createdParam = searchParams.get("created") ?? "";
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(
    (searchParams.get("filter") as QuickFilter) ?? ""
  );
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [assigneeFilter, setAssigneeFilter] = useState(searchParams.get("assignee") ?? "");
  const [scheduledOnly, setScheduledOnly] = useState(searchParams.get("scheduled") === "1");
  const [datePreset, setDatePreset] = useState<DatePreset>(
    (searchParams.get("date") as DatePreset) ?? "all"
  );
  const [startDate, setStartDate] = useState(searchParams.get("start") ?? "");
  const [endDate, setEndDate] = useState(searchParams.get("end") ?? "");
  const [sortKey, setSortKey] = useState<SortKey>(
    (searchParams.get("sort") as SortKey) ?? "scheduled_soonest"
  );
  const [deletingJobId, setDeletingJobId] = useState("");
  const [savingJobId, setSavingJobId] = useState("");
  const [actioningJobId, setActioningJobId] = useState("");
  const [activeMenuJobId, setActiveMenuJobId] = useState("");
  const [canCreateJob, setCanCreateJob] = useState<boolean | null>(null);

  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [bulkScheduleAt, setBulkScheduleAt] = useState("");
  const [bulkWorking, setBulkWorking] = useState(false);

  const refreshJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await listDashboardJobs());
    } catch (loadError) {
      setError((loadError as Error)?.message ?? "Unable to load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    let active = true;
    void checkDashboardJobCreateSupport()
      .then((supported) => {
        if (!active) return;
        setCanCreateJob(supported);
      })
      .catch(() => {
        if (!active) return;
        setCanCreateJob(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!createdParam) return;
    void refreshJobs();
  }, [createdParam, refreshJobs]);

  useEffect(() => {
    const handler = () => {
      void refreshJobs();
    };
    window.addEventListener("proscope:job-created", handler);
    return () => {
      window.removeEventListener("proscope:job-created", handler);
    };
  }, [refreshJobs]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (quickFilter) params.set("filter", quickFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (assigneeFilter) params.set("assignee", assigneeFilter);
    if (scheduledOnly) params.set("scheduled", "1");
    if (sortKey !== "scheduled_soonest") params.set("sort", sortKey);
    if (datePreset !== "all") params.set("date", datePreset);
    if (datePreset === "custom") {
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
    }
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl);
  }, [
    assigneeFilter,
    datePreset,
    endDate,
    pathname,
    quickFilter,
    query,
    router,
    scheduledOnly,
    sortKey,
    startDate,
    statusFilter,
  ]);

  const statusOptions = useMemo(() => {
    return [...new Set(jobs.map((job) => normalizeStatus(job.status)))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [jobs]);

  const assigneeOptions = useMemo(() => {
    return [...new Set(jobs.map((job) => getAssignee(job)).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [jobs]);

  const hasAssigneeSupport = assigneeOptions.length > 0;
  const hasUnscheduledJobs = jobs.some((job) => !job.scheduled_at);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const now = new Date();
    const todayStart = toStartOfDay(now);
    const todayEnd = toEndOfDay(now);
    const next7End = toEndOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));

    const rows = jobs.filter((job) => {
      const assignee = getAssignee(job);
      const text = [job.title, job.address, normalizeStatus(job.status), job.notes ?? "", assignee ?? ""]
        .join(" ")
        .toLowerCase();
      if (normalizedQuery && !text.includes(normalizedQuery)) return false;
      if (statusFilter && normalizeStatus(job.status) !== statusFilter) return false;
      if (assigneeFilter && (assignee ?? "") !== assigneeFilter) return false;
      if (scheduledOnly && !job.scheduled_at) return false;
      if (quickFilter === "past_due") {
        if (!job.scheduled_at) return false;
        const when = new Date(job.scheduled_at).getTime();
        const status = normalizeStatus(job.status);
        if (!Number.isFinite(when) || when >= todayStart.getTime()) return false;
        if (status === "completed" || status === "cancelled") return false;
      }
      if (quickFilter === "pending_review") {
        const status = normalizeStatus(job.status);
        if (!status.includes("review") && !status.includes("pending")) return false;
      }
      if (quickFilter === "issues") {
        const status = normalizeStatus(job.status);
        if (!status.includes("failed") && !status.includes("error") && !status.includes("issue")) {
          return false;
        }
      }

      if (datePreset !== "all") {
        if (!job.scheduled_at) return false;
        const when = new Date(job.scheduled_at);
        if (!Number.isFinite(when.getTime())) return false;
        if (datePreset === "today") {
          if (when < todayStart || when > todayEnd) return false;
        }
        if (datePreset === "next7") {
          if (when <= todayEnd || when > next7End) return false;
        }
        if (datePreset === "past") {
          if (when >= todayStart) return false;
        }
        if (datePreset === "custom") {
          const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
          const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
          if (start && Number.isFinite(start.getTime()) && when < start) return false;
          if (end && Number.isFinite(end.getTime()) && when > end) return false;
        }
      }
      return true;
    });

    rows.sort((a, b) => {
      if (sortKey === "scheduled_soonest") {
        const av = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
        const bv = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
        return av - bv;
      }
      if (sortKey === "title") return a.title.localeCompare(b.title);
      const av = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0;
      const bv = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0;
      return bv - av;
    });

    return rows;
  }, [
    assigneeFilter,
    datePreset,
    endDate,
    jobs,
    quickFilter,
    query,
    scheduledOnly,
    sortKey,
    startDate,
    statusFilter,
  ]);

  const filteredIdSet = useMemo(() => new Set(filteredJobs.map((job) => job.id)), [filteredJobs]);
  useEffect(() => {
    setSelectedJobIds((prev) => prev.filter((id) => filteredIdSet.has(id)));
  }, [filteredIdSet]);

  const selectedCount = selectedJobIds.length;
  const allVisibleSelected = filteredJobs.length > 0 && filteredJobs.every((job) => selectedJobIds.includes(job.id));

  const statusSet = useMemo(
    () => new Set(filteredJobs.map((job) => normalizeStatus(job.status))),
    [filteredJobs]
  );
  const deEmphasizeStatus = statusSet.size <= 1;

  const summary = useMemo(() => {
    let today = 0;
    let upcoming = 0;
    let overdue = 0;
    filteredJobs.forEach((job) => {
      const urgency = toUrgency(job);
      if (urgency === "today") today += 1;
      if (urgency === "upcoming") upcoming += 1;
      if (urgency === "overdue") overdue += 1;
    });
    return {
      today,
      upcoming,
      overdue,
    };
  }, [filteredJobs]);

  const quickFilterLabel = useMemo(() => {
    if (quickFilter === "past_due") return "Past due jobs";
    if (quickFilter === "pending_review") return "Pending review";
    if (quickFilter === "issues") return "Jobs with issues";
    return "";
  }, [quickFilter]);

  const handleDeleteJob = async (job: DashboardJob) => {
    if (!window.confirm(`Delete "${job.title}" from active jobs?`)) return;
    setDeletingJobId(job.id);
    try {
      await archiveDashboardJob(job.id);
      setJobs((prev) => prev.filter((candidate) => candidate.id !== job.id));
    } catch (deleteError) {
      window.alert((deleteError as Error)?.message ?? "Unable to delete job.");
    } finally {
      setDeletingJobId("");
    }
  };

  const handleSaveJobToComputer = async (job: DashboardJob) => {
    setSavingJobId(job.id);
    try {
      const [photos, shareLinks, reportActions] = await Promise.all([
        listDashboardPhotos(job.id).catch(() => []),
        listOwnerSharePackages(job.id).catch(() => []),
        getDashboardReportActions(job.id).catch(() => ({ reportUrl: null, shareUrl: null })),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        job,
        photos: photos.map((photo) => ({
          id: photo.id,
          storage_path: photo.storage_path,
          category: photo.category,
          caption: photo.caption,
          created_at: photo.created_at,
        })),
        shareLinks: shareLinks.map((link) => ({
          token: link.token,
          title: link.title,
          url: link.url,
          expiresAt: link.expiresAt,
          isRevoked: link.isRevoked,
          allowDownload: link.allowDownload,
          createdAt: link.createdAt,
        })),
        reportActions,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeTitle = job.title.trim().replace(/[^\w.-]+/g, "_") || "job";
      anchor.href = objectUrl;
      anchor.download = `${safeTitle}-${job.id}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (saveError) {
      window.alert((saveError as Error)?.message ?? "Unable to save job to computer.");
    } finally {
      setSavingJobId("");
    }
  };

  const handleRowOpen = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  const handleToggleRow = (jobId: string, checked: boolean) => {
    setSelectedJobIds((prev) => {
      if (checked) return [...new Set([...prev, jobId])];
      return prev.filter((id) => id !== jobId);
    });
  };

  const handleToggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedJobIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
      return;
    }
    setSelectedJobIds((prev) => [...new Set([...prev, ...filteredJobs.map((job) => job.id)])]);
  };

  const handleQuickReschedule = async (job: DashboardJob) => {
    const defaultValue = formatDateInputDefault(job.scheduled_at);
    const input = window.prompt("New schedule time (YYYY-MM-DDTHH:MM)", defaultValue);
    if (!input) return;
    const when = new Date(input);
    if (!Number.isFinite(when.getTime())) {
      window.alert("Invalid date format.");
      return;
    }
    setActioningJobId(job.id);
    try {
      await updateDashboardJob(job.id, { scheduled_at: when.toISOString() });
      await refreshJobs();
    } catch (rescheduleError) {
      window.alert((rescheduleError as Error)?.message ?? "Unable to reschedule job.");
    } finally {
      setActioningJobId("");
    }
  };

  const handleQuickStatus = async (job: DashboardJob) => {
    setActioningJobId(job.id);
    try {
      await updateDashboardJob(job.id, { status: "completed" });
      await refreshJobs();
    } catch (statusError) {
      window.alert((statusError as Error)?.message ?? "Unable to update job status.");
    } finally {
      setActioningJobId("");
    }
  };

  const runBulkAction = async (type: "cancel" | "archive" | "reschedule") => {
    if (!selectedJobIds.length) return;
    setBulkWorking(true);
    try {
      if (type === "reschedule") {
        if (!bulkScheduleAt) {
          window.alert("Choose a schedule date/time first.");
          return;
        }
        const when = new Date(bulkScheduleAt);
        if (!Number.isFinite(when.getTime())) {
          window.alert("Invalid reschedule date.");
          return;
        }
        await Promise.all(
          selectedJobIds.map((id) =>
            updateDashboardJob(id, {
              scheduled_at: when.toISOString(),
            })
          )
        );
      }
      if (type === "cancel") {
        await Promise.all(
          selectedJobIds.map((id) =>
            updateDashboardJob(id, {
              status: "cancelled",
            })
          )
        );
      }
      if (type === "archive") {
        await Promise.all(selectedJobIds.map((id) => archiveDashboardJob(id)));
      }
      setSelectedJobIds([]);
      await refreshJobs();
    } catch (bulkError) {
      window.alert((bulkError as Error)?.message ?? "Bulk action failed.");
    } finally {
      setBulkWorking(false);
    }
  };

  return (
    <section className="office-page">
      <div className="office-page-header">
        <div>
          <h3>Jobs</h3>
          <p className="muted">Operational board for scheduling, assignment, and fast job actions.</p>
        </div>
        {canCreateJob ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.dispatchEvent(new CustomEvent("proscope:open-new-job"))}
          >
            + New Job
          </button>
        ) : null}
      </div>

      {quickFilter ? (
        <div className="jobs-bulk-bar">
          <strong>Quick filter:</strong>
          <span className="muted">{quickFilterLabel}</span>
          <button
            className="btn btn-secondary office-inline-btn"
            onClick={() => setQuickFilter("")}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="jobs-summary-strip">
        <article className="jobs-summary-card">
          <p className="muted">Today</p>
          <strong>{summary.today}</strong>
        </article>
        <article className="jobs-summary-card">
          <p className="muted">Next 7 Days</p>
          <strong>{summary.upcoming}</strong>
        </article>
        <article className="jobs-summary-card">
          <p className="muted">Overdue</p>
          <strong>{summary.overdue}</strong>
        </article>
      </div>

      <div className="office-filter-bar jobs-filter-bar">
        <input
          className="input jobs-filter-search"
          placeholder="Search jobs..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="input jobs-filter-control jobs-filter-secondary"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          className="input jobs-filter-control jobs-filter-secondary"
          value={assigneeFilter}
          onChange={(event) => setAssigneeFilter(event.target.value)}
          disabled={!hasAssigneeSupport}
          title={hasAssigneeSupport ? "Filter by assignee" : "Assignee not available in current schema"}
        >
          <option value="">{hasAssigneeSupport ? "All assignees" : "Assignee unavailable"}</option>
          {assigneeOptions.map((assignee) => (
            <option key={assignee} value={assignee}>
              {assignee}
            </option>
          ))}
        </select>
        <select
          className="input jobs-filter-control jobs-filter-secondary"
          value={datePreset}
          onChange={(event) => setDatePreset(event.target.value as DatePreset)}
        >
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="next7">Next 7 days</option>
          <option value="past">Past due</option>
          <option value="custom">Custom range</option>
        </select>
        {datePreset === "custom" ? (
          <>
            <input
              className="input jobs-filter-control jobs-filter-secondary"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <input
              className="input jobs-filter-control jobs-filter-secondary"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </>
        ) : null}
        <select
          className="input jobs-filter-control jobs-filter-tertiary"
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
        >
          <option value="scheduled_soonest">Sort: Scheduled soonest</option>
          <option value="updated_at">Sort: Last updated</option>
          <option value="title">Sort: Title</option>
        </select>
        {hasUnscheduledJobs ? (
          <label className="office-inline-checkbox">
            <input
              type="checkbox"
              checked={scheduledOnly}
              onChange={(event) => setScheduledOnly(event.target.checked)}
            />
            <span>Scheduled only</span>
          </label>
        ) : null}
      </div>

      {error ? <p className="dashboard-error">{error}</p> : null}

      {!loading && selectedCount > 0 ? (
        <div className="jobs-bulk-bar">
          <strong>{selectedCount} selected</strong>
          <button
            className="btn btn-secondary office-inline-btn"
            disabled={!hasAssigneeSupport || bulkWorking}
            title={hasAssigneeSupport ? "Bulk assign" : "Assign is not available in current schema"}
          >
            Bulk Assign
          </button>
          <input
            className="input jobs-bulk-input"
            type="datetime-local"
            value={bulkScheduleAt}
            onChange={(event) => setBulkScheduleAt(event.target.value)}
          />
          <button
            className="btn btn-secondary office-inline-btn"
            onClick={() => void runBulkAction("reschedule")}
            disabled={bulkWorking}
          >
            Bulk Reschedule
          </button>
          <button
            className="btn btn-secondary office-inline-btn"
            onClick={() => void runBulkAction("cancel")}
            disabled={bulkWorking}
          >
            Bulk Cancel
          </button>
          <button
            className="btn btn-secondary office-inline-btn"
            onClick={() => void runBulkAction("archive")}
            disabled={bulkWorking}
          >
            Bulk Archive
          </button>
        </div>
      ) : null}

      {!loading ? (
        <div className="office-table-wrap">
          <table className="office-table jobs-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => handleToggleSelectAllVisible(event.target.checked)}
                    aria-label="Select all visible jobs"
                  />
                </th>
                <th>Title</th>
                <th>Address</th>
                <th>Scheduled</th>
                <th>Assignee</th>
                {!deEmphasizeStatus ? <th>Status</th> : null}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr
                  key={job.id}
                  className={`jobs-row jobs-row-${toUrgency(job)}`}
                  onClick={() => handleRowOpen(job.id)}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedJobIds.includes(job.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => handleToggleRow(job.id, event.target.checked)}
                      aria-label={`Select ${job.title}`}
                    />
                  </td>
                  <td>
                    <div className="jobs-title-cell">
                      <strong>{job.title}</strong>
                      <span className={`jobs-urgency-badge ${toUrgency(job)}`}>
                        {toUrgency(job) === "today"
                          ? "Today"
                          : toUrgency(job) === "upcoming"
                          ? "Upcoming"
                          : toUrgency(job) === "overdue"
                          ? "Overdue"
                          : "Unscheduled"}
                      </span>
                    </div>
                  </td>
                  <td className="jobs-address-cell" title={job.address}>
                    {cityStateFromAddress(job.address)}
                  </td>
                  <td className="jobs-scheduled-cell">{formatSchedule(job.scheduled_at)}</td>
                  <td>{getAssignee(job) ?? "Unassigned"}</td>
                  {!deEmphasizeStatus ? (
                    <td>
                      <span className={`jobs-status-badge status-${normalizeStatus(job.status)}`}>
                        {normalizeStatus(job.status)}
                      </span>
                    </td>
                  ) : null}
                  <td>
                    <div className="dashboard-share-actions">
                      <Link
                        className="btn btn-secondary office-inline-btn"
                        href={`/jobs/${job.id}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        Open
                      </Link>
                      <button
                        className="btn btn-secondary office-inline-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveMenuJobId((prev) => (prev === job.id ? "" : job.id));
                        }}
                      >
                        ...
                      </button>
                      {activeMenuJobId === job.id ? (
                        <div
                          className="jobs-action-menu"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            className="btn btn-secondary office-inline-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveMenuJobId("");
                              void handleSaveJobToComputer(job);
                            }}
                            disabled={savingJobId === job.id}
                          >
                            {savingJobId === job.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            className="btn btn-secondary office-inline-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveMenuJobId("");
                              void handleQuickReschedule(job);
                            }}
                            disabled={actioningJobId === job.id}
                          >
                            Reschedule
                          </button>
                          <button
                            className="btn btn-secondary office-inline-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveMenuJobId("");
                              void handleQuickStatus(job);
                            }}
                            disabled={actioningJobId === job.id || normalizeStatus(job.status) === "completed"}
                          >
                            Complete
                          </button>
                          <button
                            className="btn btn-secondary office-inline-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveMenuJobId("");
                              void handleDeleteJob(job);
                            }}
                            disabled={deletingJobId === job.id}
                          >
                            {deletingJobId === job.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!jobs.length ? (
            <p className="muted">No jobs yet. Create your first job to get started.</p>
          ) : null}
          {jobs.length > 0 && !filteredJobs.length ? (
            <p className="muted">No results match the current filters.</p>
          ) : null}
        </div>
      ) : (
        <div className="jobs-loading-shell">
          <p className="muted">Loading jobs...</p>
        </div>
      )}
    </section>
  );
}
