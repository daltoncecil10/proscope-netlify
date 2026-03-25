import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const token = new URL(request.url).searchParams.get("token") ?? "";

  const result: Record<string, unknown> = {
    hasSupabaseUrl: Boolean(url),
    hasServiceRole: Boolean(serviceRole),
    tokenProvided: Boolean(token),
  };

  if (!url || !serviceRole || !token) {
    return NextResponse.json(result, { status: 200 });
  }

  try {
    const client = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from("shared_packages")
      .select("token")
      .eq("token", token)
      .limit(1);

    result.queryOk = !error;
    result.error = error?.message ?? null;
    result.rowCount = Array.isArray(data) ? data.length : 0;
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    result.queryOk = false;
    result.error = (error as Error)?.message ?? "unknown";
    return NextResponse.json(result, { status: 200 });
  }
}
