"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

function resolvePreviewUrl(
  raw: string,
  liveOrigin: string
): {
  href: string;
  rewriteHint: string | null;
} | null {
  const normalized = normalizeUrl(raw);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    const isSharePath = url.pathname.startsWith("/share/");
    const isLocalHost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    if (isSharePath && isLocalHost && liveOrigin) {
      const live = new URL(url.pathname + url.search + url.hash, liveOrigin);
      return {
        href: live.toString(),
        rewriteHint: `Using your live site (${liveOrigin}) instead of localhost.`,
      };
    }
    if (isSharePath && isLocalHost && !liveOrigin) {
      return {
        href: normalized,
        rewriteHint:
          "This link uses localhost. Open this page on your live site (e.g. proscopenow.netlify.app) or set NEXT_PUBLIC_WEBSITE_URL on Netlify and redeploy.",
      };
    }
    return { href: normalized, rewriteHint: null };
  } catch {
    return null;
  }
}

function isSharePathUrl(href: string): boolean {
  try {
    return new URL(href).pathname.startsWith("/share/");
  } catch {
    return false;
  }
}

export default function OpenReportPage() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [copyDone, setCopyDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const liveOrigin = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_WEBSITE_URL?.replace(/\/+$/, "") ?? "";
    if (configured) return configured;
    if (!mounted || typeof window === "undefined") return "";
    return window.location.origin.replace(/\/+$/, "");
  }, [mounted]);

  const resolved = useMemo(
    () => resolvePreviewUrl(submitted, liveOrigin),
    [submitted, liveOrigin]
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setCopyDone(false);
    setSubmitted(input);
  };

  const copyResolvedLink = async () => {
    if (!resolved?.href) return;
    try {
      await navigator.clipboard.writeText(resolved.href);
      setCopyDone(true);
    } catch {
      window.prompt("Copy this link:", resolved.href);
    }
  };

  return (
    <main className="page">
      <div className="lookup-wrap">
        <Link href="/">← Back to home</Link>
        <h1 style={{ marginBottom: 8 }}>Open Your ProScope Link</h1>
        <p className="muted">
          Paste a report URL from the app. If it shows{" "}
          <code style={{ fontSize: "0.9em" }}>localhost</code>, we rewrite it to this
          site&apos;s address when possible.
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

          {submitted && !resolved && (
            <p style={{ color: "#ff8f8f", marginTop: 14 }}>
              That link is not valid. Paste a full URL from the app.
            </p>
          )}

          {resolved?.rewriteHint && (
            <p style={{ marginTop: 14, color: "#8fd4a8", fontSize: 14 }}>
              {resolved.rewriteHint}
            </p>
          )}

          {resolved && (
            <>
              <div className="lookup-row" style={{ marginTop: 16 }}>
                <a
                  className="btn btn-secondary"
                  href={resolved.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in new tab
                </a>
                {isSharePathUrl(resolved.href) ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void copyResolvedLink()}
                  >
                    {copyDone ? "Copied" : "Copy live link"}
                  </button>
                ) : (
                  <a className="btn btn-primary" href={resolved.href} download>
                    Download
                  </a>
                )}
              </div>
              <iframe
                className="preview-frame"
                src={resolved.href}
                title="Report preview"
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
