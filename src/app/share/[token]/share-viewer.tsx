"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import JSZip from "jszip";
import { SharePackage } from "@/lib/share/types";

type ShareViewerProps = {
  data: SharePackage;
};

function triggerDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
}

/** Streams PDF from our API (attachment or ?inline=1 for viewing). */
function scopePdfFilePath(token: string) {
  return `/api/share/${encodeURIComponent(token)}/scope-pdf/file`;
}

/** Same-origin PDF for iframe / “open in tab” — address bar stays on your site, not Supabase. */
function scopePdfInlinePath(token: string) {
  return `${scopePdfFilePath(token)}?inline=1`;
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
}

function extensionForAsset(asset: SharePackage["assets"][number]) {
  if (asset.type === "pdf") return "pdf";
  if (asset.type === "video") return "mp4";
  const url = asset.url.toLowerCase();
  if (url.includes(".png")) return "png";
  if (url.includes(".webp")) return "webp";
  if (url.includes(".gif")) return "gif";
  if (url.includes(".jpeg") || url.includes(".jpg")) return "jpg";
  return "jpg";
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const quoted = header.match(/filename="((?:\\.|[^"\\])*)"/i);
  if (quoted?.[1]) {
    return quoted[1].replace(/\\"/g, '"');
  }
  const utf8Star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Star?.[1]) {
    try {
      return decodeURIComponent(utf8Star[1].trim());
    } catch {
      return null;
    }
  }
  const plain = header.match(/filename=([^;]+)/i);
  if (plain?.[1]) {
    return plain[1].trim().replace(/^"+|"+$/g, "");
  }
  return null;
}

function displayStructureLabel(data: SharePackage): string | null {
  if (data.shareStructureLabel?.trim()) return data.shareStructureLabel.trim();
  const m = data.title.trim().match(/^(.+?)\s*-\s*Inspection Package\s*$/i);
  return m?.[1]?.trim() || null;
}

export function ShareViewer({ data }: ShareViewerProps) {
  const isRevoked = data.accessState === "revoked";
  const isExpired = data.accessState === "expired";
  const canDownload = data.allowDownload && data.accessState === "active";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const hasAssets = data.assets.length > 0;
  const [packing, setPacking] = useState(false);
  const [showMediaAssets, setShowMediaAssets] = useState(false);
  const [pdfDownloadOpen, setPdfDownloadOpen] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [pdfSaving, setPdfSaving] = useState(false);
  const [pdfSaveError, setPdfSaveError] = useState<string | null>(null);

  const scopePdfAsset = useMemo(
    () =>
      data.assets.find(
        (asset) =>
          asset.type === "pdf" &&
          asset.label.toLowerCase().includes("scope")
      ) ?? data.assets.find((asset) => asset.type === "pdf"),
    [data.assets]
  );
  const scopePdfInlineSrc = scopePdfInlinePath(data.token);
  const scopePdfFileHref = scopePdfFilePath(data.token);
  const structureLine = useMemo(() => displayStructureLabel(data), [data]);

  const closePdfDownloadModal = useCallback(() => {
    setPdfDownloadOpen(false);
    setCopyDone(false);
    setPdfSaveError(null);
  }, []);

  const saveScopePdfFile = useCallback(async () => {
    setPdfSaveError(null);
    setPdfSaving(true);
    try {
      const res = await fetch(scopePdfFileHref, { credentials: "same-origin" });
      if (!res.ok) {
        throw new Error(`Could not download file (${res.status}). Try again or use “Open in new tab”.`);
      }
      const fromHeader = parseFilenameFromContentDisposition(
        res.headers.get("Content-Disposition")
      );
      const fileName = fromHeader?.trim() || "ProScope-report.pdf";
      const blob = await res.blob();
      triggerBlobDownload(blob, fileName);
      closePdfDownloadModal();
    } catch (err) {
      setPdfSaveError((err as Error)?.message ?? "Download failed.");
    } finally {
      setPdfSaving(false);
    }
  }, [scopePdfFileHref, closePdfDownloadModal]);

  const copyFileDownloadLink = useCallback(async () => {
    const href = typeof window !== "undefined" ? `${window.location.origin}${scopePdfFileHref}` : "";
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      setCopyDone(true);
    } catch {
      window.prompt("Copy this link:", href);
    }
  }, [scopePdfFileHref]);

  useEffect(() => {
    if (!pdfDownloadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePdfDownloadModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pdfDownloadOpen, closePdfDownloadModal]);
  const mediaAssets = useMemo(
    () => data.assets.filter((asset) => asset.id !== scopePdfAsset?.id),
    [data.assets, scopePdfAsset?.id]
  );
  const allIds = useMemo(() => mediaAssets.map((asset) => asset.id), [mediaAssets]);
  const selectedAssets = useMemo(
    () => mediaAssets.filter((asset) => selectedIds.has(asset.id)),
    [mediaAssets, selectedIds]
  );

  const toggleAsset = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allIds));
  const clearAll = () => setSelectedIds(new Set());
  const downloadAssetArchive = async (assets: SharePackage["assets"], suffix: string) => {
    if (!assets.length) return;
    setPacking(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        assets.map(async (asset, index) => {
          const response = await fetch(asset.url);
          if (!response.ok) {
            throw new Error(`Failed to download ${asset.label} (${response.status})`);
          }
          const blob = await response.blob();
          const extension = extensionForAsset(asset);
          const fileName = `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(
            asset.label || "asset"
          )}.${extension}`;
          zip.file(fileName, blob);
        })
      );
      const archiveBlob = await zip.generateAsync({ type: "blob" });
      const safeTitle = sanitizeFileName(data.title || "proscope-package");
      triggerBlobDownload(archiveBlob, `${safeTitle}-${suffix}.zip`);
    } catch (error) {
      console.error("[share-viewer] package download failed", error);
      window.alert(
        (error as Error)?.message ??
          "Unable to prepare download package. Please try again."
      );
    } finally {
      setPacking(false);
    }
  };

  useEffect(() => {
    if (scopePdfAsset) return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        window.location.reload();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [scopePdfAsset]);

  return (
    <>
    <main className="page">
      <section className="share-wrap">
        <div className="share-header">
          <p className="eyebrow">ProScope Shared Package</p>
          <h1>{data.title}</h1>
          <p className="muted">
            {data.address} • Inspector: {data.inspectorName}
          </p>
          {data.insuredName ? (
            <p className="muted">
              <strong style={{ fontWeight: 600, color: "#e8edf7" }}>Insured:</strong>{" "}
              {data.insuredName}
            </p>
          ) : null}
          {structureLine ? (
            <p className="muted">
              <strong style={{ fontWeight: 600, color: "#e8edf7" }}>Structure:</strong>{" "}
              {structureLine}
            </p>
          ) : null}
          <p className="muted share-dates">
            Created {new Date(data.createdAt).toLocaleString()} • Expires{" "}
            {new Date(data.expiresAt).toLocaleString()}
          </p>
          <p className={`status-chip ${scopePdfAsset ? "ready" : "processing"}`}>
            Report status: {scopePdfAsset ? "Ready" : "Processing"}
          </p>
          {isRevoked ? (
            <p className="status-chip revoked">This link has been revoked by the owner.</p>
          ) : null}
          {isExpired ? (
            <p className="status-chip expired">This link is expired. Request a new one.</p>
          ) : null}
          {!data.allowDownload && data.accessState === "active" ? (
            <p className="status-chip limited">
              View-only link: downloads are disabled by the owner.
            </p>
          ) : null}
        </div>

        {scopePdfAsset ? (
          <section className="share-report-section">
            <h2>Full Report</h2>
            <p className="muted">
              This is the exact generated scope report from the app.
            </p>
            <div className="share-report-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => triggerDownload(scopePdfInlineSrc)}
                disabled={!canDownload}
              >
                Open Full Report
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPdfSaveError(null);
                  setPdfDownloadOpen(true);
                }}
                disabled={!canDownload}
              >
                Download PDF…
              </button>
            </div>
            <iframe
              className="share-report-frame"
              src={scopePdfInlineSrc}
              title="ProScope Full Report"
            />
          </section>
        ) : (
          <div className="share-report-section">
            <h2>Full Report</h2>
            <p className="muted">
              Full report PDF is still processing in the background. This page auto-refreshes
              every 30 seconds.
            </p>
            <div className="share-report-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.location.reload()}
              >
                Refresh Report Status
              </button>
            </div>
          </div>
        )}

        <div className="share-toolbar">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowMediaAssets((prev) => !prev)}
            disabled={!mediaAssets.length}
          >
            {showMediaAssets ? "Hide Media Package" : "Show Media Package"}
          </button>
        </div>

        {!hasAssets ? (
          <p className="muted">
            This link is valid, but no downloadable files are currently available for this package.
            Please regenerate the link after uploads finish.
          </p>
        ) : null}

        {showMediaAssets ? (
          <>
          <div className="share-toolbar">
            <button type="button" className="btn btn-secondary" onClick={selectAll}>
              Select All
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearAll}>
              Clear
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void downloadAssetArchive(data.assets, "all-assets");
              }}
              disabled={!hasAssets || packing || !canDownload}
            >
              {packing ? "Preparing..." : "Download Package (.zip)"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void downloadAssetArchive(selectedAssets, "selected-assets");
              }}
              disabled={!hasAssets || selectedAssets.length === 0 || packing || !canDownload}
            >
              Download Selected Zip ({selectedAssets.length})
            </button>
          </div>
          <div className="share-grid">
            {mediaAssets.map((asset) => (
            <article key={asset.id} className="share-card">
              <label className="share-check">
                <input
                  type="checkbox"
                  checked={selectedIds.has(asset.id)}
                  onChange={() => toggleAsset(asset.id)}
                />
                <span>Select</span>
              </label>

              <div className="share-preview">
                {asset.type === "video" ? (
                  <video controls preload="metadata" src={asset.url} />
                ) : asset.type === "image" ? (
                  <img src={asset.url} alt={asset.label} loading="lazy" />
                ) : asset.type === "pdf" ? (
                  <div className="share-placeholder">
                    <span>PDF</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => triggerDownload(asset.url)}
                      disabled={!canDownload}
                    >
                      Open PDF
                    </button>
                  </div>
                ) : (
                  <div className="share-placeholder">FILE</div>
                )}
              </div>

              <h3>{asset.label}</h3>
              <p className="muted">
                {asset.section} • {asset.type.toUpperCase()}
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => triggerDownload(asset.url)}
                disabled={!canDownload}
              >
                Download
              </button>
            </article>
            ))}
          </div>
          </>
        ) : (
          <p className="muted">Attachments are hidden. Open the full report above for the exact report view.</p>
        )}
      </section>
    </main>

    {pdfDownloadOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="share-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-download-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closePdfDownloadModal();
            }}
          >
            <div className="share-modal-panel" onClick={(e) => e.stopPropagation()}>
              <h3 id="pdf-download-title">Download report</h3>
              <p className="share-modal-lede">
                Choose how to get the PDF on this computer. The browser picks the save
                folder (usually Downloads); you can move the file to Desktop or anywhere else
                after it saves.
              </p>
              <div className="share-modal-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={pdfSaving || !canDownload}
                  onClick={() => void saveScopePdfFile()}
                >
                  {pdfSaving ? "Preparing…" : "Save PDF file"}
                </button>
                {pdfSaveError ? (
                  <p style={{ color: "#ff9a9a", fontSize: 13, margin: 0 }}>{pdfSaveError}</p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    triggerDownload(scopePdfInlineSrc);
                    closePdfDownloadModal();
                  }}
                >
                  Open in new tab (view, then print or save)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void copyFileDownloadLink()}
                >
                  {copyDone ? "Link copied" : "Copy file download link"}
                </button>
              </div>
              <p className="share-modal-hint">
                If “Save PDF file” does nothing, try “Open in new tab” and use your browser’s
                menu to save or print to PDF. Safari sometimes handles downloads differently
                than Chrome or Edge.
              </p>
              <div className="share-modal-close-row">
                <button type="button" className="btn btn-secondary" onClick={closePdfDownloadModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null}
    </>
  );
}
