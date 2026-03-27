"use client";

import { useAuthGuard } from "@/lib/auth/use-auth-guard";

export default function TeamPage() {
  const { user } = useAuthGuard();

  return (
    <section className="office-page">
      <div className="office-page-header">
        <h3>Team</h3>
        <p className="muted">Minimal V1 team management.</p>
      </div>

      <article className="card">
        <h4>Current Session User</h4>
        <p className="muted">Email: {user?.email ?? "Unknown"}</p>
        <p className="muted">Role: Admin (current session)</p>
        <p className="muted">Status: Active</p>
      </article>
    </section>
  );
}
