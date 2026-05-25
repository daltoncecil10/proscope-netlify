import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Legacy path: redirect to same-origin PDF stream so the browser never lands on
 * a raw Supabase signed URL.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await context.params;
  const token = decodeURIComponent(rawToken ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const dest = new URL(
    `/api/share/${encodeURIComponent(token)}/scope-pdf/file?inline=1`,
    request.url
  );
  return NextResponse.redirect(dest, 302);
}
