import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-fallback" />
        <video autoPlay muted loop playsInline preload="metadata">
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="eyebrow">ProScope Platform</div>
          <h1>Capture Smarter. Report Faster.</h1>
          <p>
            Field-first inspections with photo evidence, professional reports, and shareable links
            your team can open from anywhere.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/login">
              Open Office Dashboard
            </Link>
            <Link className="btn btn-primary" href="/open">
              Open Report Link
            </Link>
            <Link className="btn btn-secondary" href="/share/demo-claim-001">
              View Share Demo
            </Link>
            <a className="btn btn-secondary" href="#features">
              See Features
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <h2>Built for real field workflows</h2>
        <p className="muted">
          ProScope keeps field capture fast on mobile and gives office teams a clean place to
          review, organize, and share.
        </p>
        <div className="grid" style={{ marginTop: 18 }}>
          <article className="card">
            <h3>Photo-First</h3>
            <p className="muted">
              Capture organized evidence fast on-site without slowing down the crew.
            </p>
          </article>
          <article className="card">
            <h3>Shareable Links</h3>
            <p className="muted">
              Send report links to adjusters, office staff, and customers in a few taps.
            </p>
          </article>
          <article className="card">
            <h3>Office Dashboard</h3>
            <p className="muted">
              Review jobs, manage photos, and handle reports from a structured web workspace.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
