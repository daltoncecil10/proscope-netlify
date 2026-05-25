import { NextResponse } from "next/server";
import { getSharePackageByToken } from "@/lib/share/provider";

export const dynamic = "force-dynamic";

function pickScopePdf(
  pkg: NonNullable<Awaited<ReturnType<typeof getSharePackageByToken>>>
) {
  return (
    pkg.assets.find(
      (a) => a.type === "pdf" && a.label.toLowerCase().includes("scope")
    ) ?? pkg.assets.find((a) => a.type === "pdf")
  );
}

function streetLineFromAddress(address: string): string | null {
  const line = address.split(",")[0]?.trim();
  return line && line.length >= 3 ? line : null;
}

function sanitizeDownloadBase(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .slice(0, 100)
    .trim();
  return cleaned.length > 0 ? cleaned : "ProScope-report";
}

function structureGuessFromTitle(title: string): string | null {
  const m = title.match(/^(.+?)\s*-\s*Inspection Package\s*$/i);
  return m?.[1]?.trim() || null;
}

function downloadPdfFileName(pkg: NonNullable<Awaited<ReturnType<typeof getSharePackageByToken>>>) {
  const insuredRaw = pkg.insuredName?.trim();
  const structureRaw =
    pkg.shareStructureLabel?.trim() || structureGuessFromTitle(pkg.title.trim());

  const insured = insuredRaw ? sanitizeDownloadBase(insuredRaw) : "";
  const structure = structureRaw ? sanitizeDownloadBase(structureRaw) : "";

  const parts: string[] = [];
  if (insured) parts.push(insured);
  if (structure) parts.push(structure);

  let base: string;
  if (parts.length >= 2) {
    base = `${parts[0]} - ${parts[1]}`;
  } else if (parts.length === 1) {
    base = parts[0];
  } else {
    const street = streetLineFromAddress(pkg.address);
    if (street) {
      base = sanitizeDownloadBase(street);
    } else {
      const title = pkg.title.trim();
      const simplified = title
        .replace(/\s*-\s*Inspection Package\s*$/i, "")
        .replace(/\s*-\s*Multi-Structure Package\s*$/i, "")
        .trim();
      const t = simplified.length > 0 ? simplified : title;
      base = sanitizeDownloadBase(t);
    }
  }

  return `${base} - ProScope report.pdf`.slice(0, 200);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await context.params;
  const token = decodeURIComponent(rawToken ?? "").trim();
  const inline =
    new URL(request.url).searchParams.get("inline") === "1" ||
    new URL(request.url).searchParams.get("view") === "1";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const pkg = await getSharePackageByToken(token);
  if (!pkg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (pkg.accessState !== "active") {
    return NextResponse.json({ error: "Link inactive" }, { status: 410 });
  }
  if (!pkg.allowDownload) {
    return NextResponse.json({ error: "Downloads disabled" }, { status: 403 });
  }

  const pdf = pickScopePdf(pkg);
  if (!pdf?.url) {
    return NextResponse.json({ error: "Report not ready" }, { status: 404 });
  }

  const upstream = await fetch(pdf.url, { cache: "no-store" });
  if (!upstream.ok) {
    console.error("[scope-pdf/file] upstream fetch failed", upstream.status);
    return NextResponse.json({ error: "Could not read PDF" }, { status: 502 });
  }

  const buf = await upstream.arrayBuffer();
  const filename = downloadPdfFileName(pkg);

  const disposition = inline
    ? `inline; filename="${filename}"`
    : `attachment; filename="${filename}"`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": "no-store",
    },
  });
}
