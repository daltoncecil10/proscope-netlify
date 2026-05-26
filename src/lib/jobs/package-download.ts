import JSZip from "jszip";
import { listDashboardPhotos } from "@/lib/dashboard/provider";
import type { DashboardJob } from "@/lib/dashboard/types";

function safeFilename(name: string): string {
  return name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "job";
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/** Download scope PDF + photos as a zip to the user's device. */
export async function downloadJobPackage(job: DashboardJob): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder("photos");

  if (job.pdfUrl) {
    const pdf = await fetchBlob(job.pdfUrl);
    if (pdf) zip.file("scope-report.pdf", pdf);
  }

  const photos = await listDashboardPhotos(job.id);
  let photoIndex = 0;
  for (const photo of photos) {
    if (!photo.signed_url) continue;
    const blob = await fetchBlob(photo.signed_url);
    if (!blob) continue;
    photoIndex += 1;
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const name = photo.caption?.trim() || `photo-${photoIndex}`;
    folder?.file(`${safeFilename(name)}.${ext}`, blob);
  }

  if (!job.pdfUrl && photoIndex === 0) {
    throw new Error("No files available to download for this job yet.");
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${safeFilename(job.title)}-package.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export async function downloadSinglePhoto(
  url: string,
  filename: string
): Promise<void> {
  const blob = await fetchBlob(url);
  if (!blob) throw new Error("Could not download photo.");
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
