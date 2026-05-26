"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NewJobModal, formValuesToScheduledAt, type NewJobFormValues } from "@/components/office/new-job-modal";
import { OfficeShell } from "@/components/office/office-shell";
import { ShareJobModal } from "@/components/office/share-job-modal";
import styles from "@/components/office/office.module.css";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";
import { createCalendarEvent } from "@/lib/calendar/events";
import { listDashboardJobs } from "@/lib/dashboard/provider";
import type { DashboardJob } from "@/lib/dashboard/types";
import {
  inviteTeamMember,
  listSharedJobsForUser,
  listTeamMembers,
  resendInvite,
  type JobShareRecord,
  type TeamMemberRecord,
} from "@/lib/team/store";

type SharedFilter = "all" | "with_me" | "by_me";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "?";
  return local.slice(0, 2).toUpperCase();
}

function hashColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 42% 42%)`;
}

function formatSharedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DirectionTag({ direction }: { direction: "in" | "out" }) {
  const isIn = direction === "in";
  return (
    <span
      className={`${styles.directionTag} ${isIn ? styles.directionTagIn : styles.directionTagOut}`}
    >
      {isIn ? "Shared with me" : "Shared by me"}
    </span>
  );
}

export function TeamClient() {
  const { user } = useOfficeAuth();
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [shares, setShares] = useState<JobShareRecord[]>([]);
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [sharedFilter, setSharedFilter] = useState<SharedFilter>("all");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [newJobSaving, setNewJobSaving] = useState(false);
  const [newJobError, setNewJobError] = useState<string | null>(null);

  const ownerEmail = user?.email ?? "";

  const reload = useCallback(() => {
    if (!user?.id || !ownerEmail) return;
    setMembers(listTeamMembers(user.id, ownerEmail));
    setShares(listSharedJobsForUser(user.id, ownerEmail));
    void listDashboardJobs(user.id).then(setJobs);
  }, [user?.id, ownerEmail]);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members]
  );

  const sharedJobs = useMemo(() => {
    if (sharedFilter === "with_me") {
      return shares.filter((j) => j.direction === "in");
    }
    if (sharedFilter === "by_me") {
      return shares.filter((j) => j.direction === "out");
    }
    return shares;
  }, [shares, sharedFilter]);

  const shopSlug = ownerEmail.split("@")[0] ?? "your-shop";

  const sendInvite = () => {
    if (!user?.id || !ownerEmail) return;
    setInviteError(null);
    try {
      inviteTeamMember(user.id, ownerEmail, inviteEmail);
      setInviteEmail("");
      reload();
    } catch (err) {
      setInviteError((err as Error)?.message ?? "Could not send invite");
    }
  };

  const handleResend = (memberId: string) => {
    if (!user?.id || !ownerEmail) return;
    try {
      resendInvite(user.id, ownerEmail, memberId);
      reload();
    } catch (err) {
      window.alert((err as Error)?.message ?? "Could not resend invite");
    }
  };

  const createJob = async (values: NewJobFormValues) => {
    if (!user?.id) return;
    setNewJobSaving(true);
    setNewJobError(null);
    try {
      await createCalendarEvent(user.id, {
        title: values.title,
        address: values.address,
        scheduledAt: formValuesToScheduledAt(values),
        eventType: "inspection",
        notes: values.notes,
      });
      setNewJobOpen(false);
      reload();
    } catch (err) {
      setNewJobError((err as Error)?.message ?? "Failed to create job");
    } finally {
      setNewJobSaving(false);
    }
  };

  return (
    <OfficeShell
      activeNav="team"
      user={user}
      crumbs={
        <>
          <span>ProScope Office</span>
          <span className={styles.crumbsHere}>/ Team</span>
        </>
      }
      topbarEnd={
        <button type="button" className={styles.btnPrimary} onClick={() => setNewJobOpen(true)}>
          + New job
        </button>
      }
    >
      <div className={styles.content}>
        <div className={styles.teamHeader}>
          <div>
            <h1 className={styles.pageH1}>Team</h1>
            <p className={styles.pageMeta}>
              <span className={styles.pillLink}>{activeMembers.length} members</span> in your shop ·{" "}
              {shares.length} jobs shared
            </p>
          </div>
          <div className={styles.teamHeaderActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setShareOpen(true)}>
              Share a job
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>(
                  'input[type="email"][placeholder*="Invite"]'
                );
                input?.focus();
              }}
            >
              + Invite teammate
            </button>
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              Shared jobs <span className={styles.countPill}>{shares.length}</span>
            </div>
            <div className={styles.chips}>
              {(
                [
                  ["all", "All", shares.length],
                  ["with_me", "Shared with me", shares.filter((j) => j.direction === "in").length],
                  ["by_me", "Shared by me", shares.filter((j) => j.direction === "out").length],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.chip} ${sharedFilter === key ? styles.chipActive : ""}`}
                  onClick={() => setSharedFilter(key)}
                >
                  {label} {count}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.tableWrap}>
            {sharedJobs.length ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 110 }} />
                    <th>Job</th>
                    <th style={{ width: 200 }}>Owner</th>
                    <th style={{ width: 200 }}>Shared with</th>
                    <th style={{ width: 130 }}>Shared</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {sharedJobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <DirectionTag direction={job.direction} />
                      </td>
                      <td>
                        <div className={styles.jobCellTitle}>{job.jobTitle}</div>
                        <div className={styles.jobCellAddr}>{job.jobAddress}</div>
                      </td>
                      <td>
                        <div className={styles.avWithName}>
                          <span
                            className={styles.avSm}
                            style={{ background: hashColor(job.ownerEmail) }}
                          >
                            {initialsFromEmail(job.ownerEmail)}
                          </span>
                          <span className={styles.avName}>{job.ownerEmail}</span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.monoMute}>
                          {job.sharedWithEmails.length
                            ? job.sharedWithEmails.join(", ")
                            : job.externalShareUrl
                              ? "External link"
                              : "—"}
                        </span>
                      </td>
                      <td>
                        <span className={styles.mono}>{formatSharedAt(job.sharedAt)}</span>
                      </td>
                      <td>
                        <Link
                          href={`/jobs/${job.jobId}`}
                          className={styles.rowActionBtn}
                          title="Open"
                          aria-label="Open job"
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.loading} style={{ padding: 24 }}>
                No shared jobs yet. Use <strong>Share a job</strong> to send packages internally or
                via link.
              </p>
            )}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              Members <span className={styles.countPill}>{members.length}</span>
            </div>
            <span className={styles.shopMeta}>
              Shop · {ownerEmail || "Signed in"} · proscope.app/{shopSlug}
            </span>
          </div>

          <div className={styles.inviteBar}>
            <div className={styles.inviteField}>
              <span aria-hidden>✉</span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendInvite();
                }}
                placeholder="Invite by email — they'll only see jobs you share with them"
              />
            </div>
            <span className={styles.inviteHint}>↵ to send</span>
            <button type="button" className={styles.btnPrimary} onClick={sendInvite}>
              + Send invite
            </button>
          </div>
          {inviteError ? <p className={styles.error} style={{ padding: "0 14px 14px" }}>{inviteError}</p> : null}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th style={{ width: 130 }}>Role</th>
                  <th style={{ width: 140 }}>Jobs shared</th>
                  <th style={{ width: 140 }}>Joined</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isPending = member.status === "pending";
                  const isYou = member.role === "owner";
                  const displayEmail = member.email;
                  const displayName = isYou
                    ? (ownerEmail.split("@")[0] ?? member.name)
                    : member.name;

                  return (
                    <tr key={member.id} className={isPending ? styles.pendingRow : undefined}>
                      <td>
                        <div className={styles.memberCell}>
                          <span
                            className={styles.memberAv}
                            style={{
                              background: hashColor(member.email),
                              color: isPending ? "var(--ink-mute)" : "#fff",
                            }}
                          >
                            {initialsFromEmail(member.email)}
                          </span>
                          <div className={styles.memberIdent}>
                            <div className={styles.memberNm}>
                              {isPending ? (
                                displayEmail
                              ) : (
                                <>
                                  {displayName}
                                  {isYou ? <span className={styles.memberYou}>· you</span> : null}
                                </>
                              )}
                            </div>
                            <div className={styles.memberEm}>
                              {isPending && member.inviteSentAt
                                ? `Invite sent ${formatSharedAt(member.inviteSentAt)}`
                                : displayEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`${styles.rolePill} ${
                            member.role === "owner"
                              ? styles.rolePillOwner
                              : member.role === "pending"
                                ? styles.rolePillPending
                                : ""
                          }`}
                        >
                          {member.role === "owner"
                            ? "Owner"
                            : member.role === "pending"
                              ? "Pending"
                              : "Member"}
                        </span>
                      </td>
                      <td>
                        {member.jobsShared === null ? (
                          <span className={styles.mono}>—</span>
                        ) : (
                          <span className={styles.accessCount}>
                            {member.jobsShared}{" "}
                            <span className={styles.accessCountU}>
                              {member.jobsShared === 1 ? "job" : "jobs"}
                            </span>
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={styles.mono}
                          style={isPending ? { color: "var(--ink-faint)" } : undefined}
                        >
                          {member.joinedAt ? formatSharedAt(member.joinedAt) : "—"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {isPending ? (
                            <button
                              type="button"
                              className={styles.resendLink}
                              onClick={() => handleResend(member.id)}
                            >
                              Resend
                            </button>
                          ) : isYou ? null : (
                            <span className={styles.monoMute}>Active</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {user?.id && ownerEmail ? (
        <ShareJobModal
          open={shareOpen}
          jobs={jobs}
          members={members}
          userId={user.id}
          ownerEmail={ownerEmail}
          onClose={() => setShareOpen(false)}
          onShared={reload}
        />
      ) : null}

      <NewJobModal
        open={newJobOpen}
        saving={newJobSaving}
        error={newJobError}
        showEventType={false}
        onClose={() => {
          if (!newJobSaving) setNewJobOpen(false);
        }}
        onSubmit={(values) => void createJob(values)}
      />
    </OfficeShell>
  );
}
