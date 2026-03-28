"use client";

import { useAuthGuard } from "@/lib/auth/use-auth-guard";

export default function TeamPage() {
  const { user } = useAuthGuard();

  return (
    <section className="office-page team-page">
      <div className="office-page-header">
        <h3>Team</h3>
        <p className="muted">Manage your account and team access.</p>
      </div>

      <article className="card team-account-card">
        <h4>Your Account</h4>
        <dl className="job-meta-list">
          <div className="job-meta-row">
            <dt>Email</dt>
            <dd>{user?.email ?? "Unknown"}</dd>
          </div>
          <div className="job-meta-row">
            <dt>Role</dt>
            <dd>Admin</dd>
          </div>
          <div className="job-meta-row">
            <dt>Status</dt>
            <dd>Active</dd>
          </div>
        </dl>
        <div className="team-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled
            title="Invites will be enabled in a future release."
          >
            Invite team members (coming soon)
          </button>
        </div>
      </article>
    </section>
  );
}
