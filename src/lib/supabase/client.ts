import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUILD_STUB_URL = "https://placeholder.supabase.co";
const BUILD_STUB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return { url, anonKey };
}

const env = readEnv();

/** True when real Supabase URL + anon key are set in .env.local / Netlify. */
export const isSupabaseConfigured = Boolean(env.url && env.anonKey);

export const SUPABASE_SETUP_MESSAGE =
  "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (Supabase → Project Settings → API), then restart npm run dev.";

const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

function createSupabaseClient(): SupabaseClient {
  const url = env.url || (isProductionBuild ? BUILD_STUB_URL : "");
  const anonKey = env.anonKey || (isProductionBuild ? BUILD_STUB_KEY : "");

  if (!url || !anonKey) {
    throw new Error(SUPABASE_SETUP_MESSAGE);
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createSupabaseClient();
  }
  return client;
}

/**
 * Browser-safe client. When env is missing, auth calls must not run (see isSupabaseConfigured).
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getSupabase();
    const value = real[prop as keyof SupabaseClient];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(real);
    }
    return value;
  },
});
