"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OfficeShell } from "@/components/office/office-shell";
import styles from "@/components/office/office.module.css";
import { DEMO_MEMBERS, DEMO_SHARED_JOBS } from "@/constants/teamDemo";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";

type SharedFilter = "all" | "with_me" | "by_me";

function DirectionTag({ direction }: { direction: "in" | "out" }) {
  const isIn = direction === "in";
  return (
    <span
      className={`${styles.directionTag} ${isIn ? styles.directionTagIn : styles.directionTagOut}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {isIn ? (
          <path d="M19 12H5m0 0l5-5m-5 5l5 5" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M5 12h14m0 0l-5-5m5 5l-5 5" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      {isIn ? "Shared with me" : "Shared by me"}
    </span>
  );
}

function AvatarStack({
  people,
}: {
  people: { initials: string; avatar: string }[];
}) {
  return (
    <div className={styles.avStack}>
      {people.map((person, i) => (
        <span
          key={`${person.initials}-${i}`}
          className={styles.avSm}
          style={{ background: person.avatar }}
        >
          {person.initials}
        </span>
      ))}
    </div>
  );
}

export function TeamClient() {
  const { user } = useOfficeAuth();
  const [sharedFilter, setSharedFilter] = useState<SharedFilter>("all");
  const [inviteEmail, setInviteEmail] = useState("");

  const activeMembers = useMemo(
    () => DEMO_MEMBERS.filter((m) => m.status === "active"),
    []
  );

  const sharedJobs = useMemo(() => {
    if (sharedFilter === "with_me") {
      return DEMO_SHARED_JOBS.filter((j) => j.direction === "in");
    }
    if (sharedFilter === "by_me") {
      return DEMO_SHARED_JOBS.filter((j) => j.direction === "out");
    }
    return DEMO_SHARED_JOBS;
  }, [sharedFilter]);

  const shopSlug = user?.email?.split("@")[0] ?? "your-shop";

  const sendInvite = () => {
    if (!inviteEmail.trim()) return;
    setInviteEmail("");
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
        <button type="button" className={styles.btnPrimary}>
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
              {DEMO_SHARED_JOBS.length} jobs shared
            </p>
          </div>
          <div className={styles.teamHeaderActions}>
            <button type="button" className={styles.btnSecondary}>
              Share a job
            </button>
            <button type="button" className={styles.btnPrimary}>
              + Invite teammate
            </button>
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              Shared jobs <span className={styles.countPill}>{DEMO_SHARED_JOBS.length}</span>
            </div>
            <div className={styles.chips}>
              {(
                [
                  ["all", "All", DEMO_SHARED_JOBS.length],
                  [
                    "with_me",
                    "Shared with me",
                    DEMO_SHARED_JOBS.filter((j) => j.direction === "in").length,
                  ],
                  [
                    "by_me",
                    "Shared by me",
                    DEMO_SHARED_JOBS.filter((j) => j.direction === "out").length,
                  ],
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
                      <div className={styles.jobCellTitle}>{job.title}</div>
                      <div className={styles.jobCellAddr}>{job.address}</div>
                    </td>
                    <td>
                      <div className={styles.avWithName}>
                        <span
                          className={styles.avSm}
                          style={{ background: job.owner.avatar }}
                        >
                          {job.owner.initials}
                        </span>
                        <span className={styles.avName}>{job.owner.name}</span>
                      </div>
                    </td>
                    <td>
                      <AvatarStack people={job.sharedWith} />
                    </td>
                    <td>
                      <span className={styles.mono}>{job.sharedAt}</span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link
                          href={`/jobs/${job.id}`}
                          className={styles.rowActionBtn}
                          title="Open"
                          aria-label="Open job"
                        >
                          →
                        </Link>
                        <button type="button" className={styles.rowActionBtn} title="More">
                          ⋯
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleRow}>
              Members <span className={styles.countPill}>{DEMO_MEMBERS.length}</span>
            </div>
            <span className={styles.shopMeta}>
              Shop · ProScope Office · proscope.app/{shopSlug}
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
                {DEMO_MEMBERS.map((member) => {
                  const isPending = member.status === "pending";
                  const displayEmail =
                    member.isYou && user?.email ? user.email : member.email;
                  const displayName =
                    member.isYou && user?.email
                      ? (user.email.split("@")[0] ?? member.name)
                      : member.name;

                  return (
                    <tr
                      key={member.id}
                      className={isPending ? styles.pendingRow : undefined}
                    >
                      <td>
                        <div className={styles.memberCell}>
                          <span
                            className={styles.memberAv}
                            style={{
                              background: member.avatar,
                              color: isPending ? "var(--ink-mute)" : "#fff",
                            }}
                          >
                            {member.initials}
                          </span>
                          <div className={styles.memberIdent}>
                            <div className={styles.memberNm}>
                              {isPending ? (
                                displayEmail
                              ) : (
                                <>
                                  {member.isYou ? displayName : member.name}
                                  {member.isYou ? (
                                    <span className={styles.memberYou}>· you</span>
                                  ) : null}
                                </>
                              )}
                            </div>
                            <div className={styles.memberEm}>
                              {isPending
                                ? `Invite sent ${member.inviteSent}`
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
                          {member.joined ?? "—"}
                        </span>
                      </td>
                      <td>
                        <div
                          className={styles.rowActions}
                          style={member.isYou || isPending ? { opacity: 1 } : undefined}
                        >
                          {isPending ? (
                            <button type="button" className={styles.resendLink}>
                              Resend
                            </button>
                          ) : member.isYou ? null : (
                            <button type="button" className={styles.rowActionBtn} title="More">
                              ⋯
                            </button>
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
    </OfficeShell>
  );
}
