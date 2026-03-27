export default function SettingsPage() {
  return (
    <section className="office-page">
      <div className="office-page-header">
        <h3>Settings</h3>
        <p className="muted">Minimal V1 company and account settings.</p>
      </div>

      <div className="office-section-grid">
        <article className="card">
          <h4>Company</h4>
          <p className="muted">Company profile and branding settings will live here.</p>
        </article>
        <article className="card">
          <h4>Share Defaults</h4>
          <p className="muted">Default share link behavior can be configured here in V1.</p>
        </article>
        <article className="card">
          <h4>Storage</h4>
          <p className="muted">Storage usage and cleanup controls will appear here as available.</p>
        </article>
      </div>
    </section>
  );
}
