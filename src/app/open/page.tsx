"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.toString();
  } catch {
    return null;
  }
}

export default function OpenReportPage() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const parsedUrl = useMemo(() => normalizeUrl(submitted), [submitted]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(input);
  };

  return (
    <main className="page">
      <div className="lookup-wrap">
        <Link href="/">← Back to home</Link>
        <h1 style={{ marginBottom: 8 }}>Open Your ProScope Link</h1>
        <p className="muted">
          Paste a report URL from the app to preview, open, and download.
        </p>

        <div className="lookup-card">
          <form onSubmit={onSubmit}>
            <label htmlFor="report-link">Report link</label>
            <div className="lookup-row">
              <input
                id="report-link"
                className="input"
                placeholder="https://..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">
                Preview
              </button>
            </div>
          </form>

          {submitted && !parsedUrl && (
            <p style={{ color: "#ff8f8f", marginTop: 14 }}>
              That link is not valid. Paste a full URL from the app.
            </p>
          )}

          {parsedUrl && (
            <>
              <div className="lookup-row" style={{ marginTop: 16 }}>
                <a className="btn btn-secondary" href={parsedUrl} target="_blank">
                  Open in new tab
                </a>
                <a className="btn btn-primary" href={parsedUrl} download>
                  Download
                </a>
              </div>
              <iframe
                className="preview-frame"
                src={parsedUrl}
                title="Report preview"
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
