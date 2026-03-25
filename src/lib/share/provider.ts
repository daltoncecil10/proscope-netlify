import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { MOCK_SHARE_PACKAGES } from "@/lib/share/mock-data";
import { supabase as browserSupabase } from "@/lib/supabase/client";
import {
  OwnerSharePackage,
  ShareAccessState,
  ShareAsset,
  ShareAssetType,
  SharePackage,
} from "@/lib/share/types";

type JsonRow = Record<string, unknown>;

// Use canonical schema names to avoid accidental Vercel env drift.
const SHARE_PACKAGE_TABLE = "shared_packages";
const SHARE_PACKAGE_TOKEN_COLUMN = "token";
const SHARE_ASSET_TABLE = "shared_assets";
const SHARE_ASSET_PACKAGE_ID_COLUMN = "package_id";
const SHARE_ASSET_TOKEN_COLUMN = "token";
const SIGNED_URL_TTL_SECONDS = Number(process.env.SHARE_SIGNED_URL_TTL_SECONDS ?? "3600");

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asIsoDate(value: unknown, fallback: string): string {
  const text = asString(value);
  if (!text) return fallback;
  const candidate = new Date(text);
  return Number.isNaN(candidate.getTime()) ? fallback : candidate.toISOString();
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function plusDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function asAssetType(value: unknown): ShareAssetType {
  if (value === "image" || value === "video" || value === "pdf") return value;
  return "image";
}

function resolveAccessState(expiresAtIso: string, isRevoked: boolean): ShareAccessState {
  if (isRevoked) return "revoked";
  const expiresAt = new Date(expiresAtIso).getTime();
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return "expired";
  return "active";
}

function mapRowToSharePackage(row: JsonRow, token: string, assets: ShareAsset[]): SharePackage {
  const nowIso = new Date().toISOString();
  const expiresAt = asIsoDate(row.expires_at ?? row.expiresAt, plusDaysIso(30));
  const isRevoked = asBoolean(row.is_revoked ?? row.isRevoked, false);
  const accessState = resolveAccessState(expiresAt, isRevoked);
  const allowDownload = asBoolean(row.allow_download ?? row.allowDownload, true);

  return {
    token,
    title: asString(row.title) ?? asString(row.name) ?? "Inspection Share Package",
    address:
      asString(row.address) ??
      asString(row.property_address) ??
      "Property address not provided",
    inspectorName:
      asString(row.inspector_name) ?? asString(row.inspector) ?? "ProScope Inspector",
    createdAt: asIsoDate(row.created_at ?? row.createdAt, nowIso),
    expiresAt,
    accessState,
    allowDownload,
    assets: accessState === "active" ? assets : [],
  };
}

function buildSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("Share provider missing Supabase env", {
      hasUrl: Boolean(url),
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function generateTokenPart() {
  return Math.random().toString(36).slice(2);
}

function generateShareToken() {
  const randomUuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "")
      : "";
  const seed = `${Date.now().toString(36)}${randomUuid}${generateTokenPart()}${generateTokenPart()}`;
  return seed.slice(0, 24);
}

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return null;
  return { url, key };
}

function buildShareUrl(token: string) {
  const base = (process.env.NEXT_PUBLIC_WEBSITE_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
  return `${base}/share/${token}`;
}

async function resolveAssetUrl(
  client: SupabaseClient,
  row: JsonRow
): Promise<string | null> {
  const directUrl = asString(row.url) ?? asString(row.public_url);
  if (directUrl) return directUrl;

  const bucket = asString(row.bucket);
  const path =
    asString(row.path) ?? asString(row.storage_path) ?? asString(row.object_path);
  if (!bucket || !path) return null;

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("Failed to create signed URL", { bucket, path, error: error.message });
    return null;
  }

  return data.signedUrl;
}

async function mapRowToAsset(
  client: SupabaseClient,
  row: JsonRow,
  fallbackId: string
): Promise<ShareAsset | null> {
  const url = await resolveAssetUrl(client, row);
  if (!url) return null;

  return {
    id: asString(row.id) ?? fallbackId,
    label: asString(row.label) ?? asString(row.caption) ?? "Untitled asset",
    section: asString(row.section) ?? "General",
    type: asAssetType(row.type),
    url
  };
}

async function mapInlineAssets(
  client: SupabaseClient,
  rows: unknown[],
  token: string
): Promise<ShareAsset[]> {
  const assets = await Promise.all(
    rows
      .filter((row): row is JsonRow => typeof row === "object" && row !== null)
      .map((row, index) => mapRowToAsset(client, row, `${token}-inline-${index}`))
  );
  return assets.filter((asset): asset is ShareAsset => Boolean(asset));
}

async function restFetchJson<T>(url: string, key: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function signUrlViaRest(
  url: string,
  key: string,
  bucket: string,
  path: string
): Promise<string | null> {
  const encodedPath = encodeStoragePath(path);
  const endpoint = `${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`;
  const payload = await restFetchJson<{ signedURL?: string }>(endpoint, key, {
    method: "POST",
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
  });
  if (!payload?.signedURL) return null;
  if (payload.signedURL.startsWith("http")) return payload.signedURL;
  return `${url}/storage/v1${payload.signedURL}`;
}

async function mapInlineAssetsViaRest(
  url: string,
  key: string,
  rows: unknown[],
  token: string
): Promise<ShareAsset[]> {
  const assets = await Promise.all(
    rows
      .filter((row): row is JsonRow => typeof row === "object" && row !== null)
      .map(async (row, index) => {
        const directUrl = asString(row.url) ?? asString(row.public_url);
        const bucket = asString(row.bucket);
        const path =
          asString(row.path) ?? asString(row.storage_path) ?? asString(row.object_path);
        const signedUrl =
          directUrl || (bucket && path ? await signUrlViaRest(url, key, bucket, path) : null);
        if (!signedUrl) return null;
        return {
          id: asString(row.id) ?? `${token}-rest-inline-${index}`,
          label: asString(row.label) ?? asString(row.caption) ?? "Untitled asset",
          section: asString(row.section) ?? "General",
          type: asAssetType(row.type),
          url: signedUrl,
        } satisfies ShareAsset;
      })
  );
  return assets.filter((asset): asset is ShareAsset => Boolean(asset));
}

async function getSharePackageViaRest(token: string): Promise<SharePackage | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const endpoint =
    `${env.url}/rest/v1/${encodeURIComponent(SHARE_PACKAGE_TABLE)}` +
    `?select=*&${encodeURIComponent(SHARE_PACKAGE_TOKEN_COLUMN)}=eq.${encodeURIComponent(token)}` +
    `&limit=1`;
  const rows = await restFetchJson<JsonRow[]>(endpoint, env.key);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  const inlineRows = Array.isArray(row.assets) ? row.assets : [];
  const assets = await mapInlineAssetsViaRest(env.url, env.key, inlineRows, token);
  return mapRowToSharePackage(row, token, assets);
}

async function loadAssetRows(
  client: SupabaseClient,
  token: string,
  packageId: string | null
): Promise<JsonRow[]> {
  const byPackage = packageId
    ? await client
        .from(SHARE_ASSET_TABLE)
        .select("*")
        .eq(SHARE_ASSET_PACKAGE_ID_COLUMN, packageId)
        .order("sort_order", { ascending: true })
        .limit(500)
    : null;

  if (byPackage && !byPackage.error && Array.isArray(byPackage.data) && byPackage.data.length > 0) {
    return byPackage.data as JsonRow[];
  }

  const byToken = await client
    .from(SHARE_ASSET_TABLE)
    .select("*")
    .eq(SHARE_ASSET_TOKEN_COLUMN, token)
    .order("sort_order", { ascending: true })
    .limit(500);

  if (byToken.error || !Array.isArray(byToken.data)) {
    return [];
  }

  return byToken.data as JsonRow[];
}

async function getSupabaseSharePackageByToken(
  client: SupabaseClient,
  token: string
): Promise<SharePackage | null> {
  const { data, error } = await client
    .from(SHARE_PACKAGE_TABLE)
    .select("*")
    .eq(SHARE_PACKAGE_TOKEN_COLUMN, token)
    .maybeSingle();
  if (error) {
    console.error("Failed to query share package", {
      token,
      table: SHARE_PACKAGE_TABLE,
      tokenColumn: SHARE_PACKAGE_TOKEN_COLUMN,
      error: error.message,
    });
    return null;
  }
  if (!data) {
    console.warn("No share package found for token", {
      token,
      table: SHARE_PACKAGE_TABLE,
      tokenColumn: SHARE_PACKAGE_TOKEN_COLUMN,
    });
    return null;
  }

  const row = data as JsonRow;
  const packageId = asString(row.id);
  const inlineAssets = Array.isArray(row.assets)
    ? await mapInlineAssets(client, row.assets, token)
    : [];

  const tableRows = inlineAssets.length
    ? []
    : await loadAssetRows(client, token, packageId);
  const tableAssets = await Promise.all(
    tableRows.map((assetRow, index) =>
      mapRowToAsset(client, assetRow, `${token}-asset-${index}`)
    )
  );

  const assets = (inlineAssets.length ? inlineAssets : tableAssets).filter(
    (asset): asset is ShareAsset => Boolean(asset)
  );

  return mapRowToSharePackage(row, token, assets);
}

export async function getSharePackageByToken(
  token: string
): Promise<SharePackage | null> {
  // Keep route UI stable while backend implementation evolves.
  const client = buildSupabaseClient();
  if (!client) {
    return MOCK_SHARE_PACKAGES[token] ?? null;
  }

  try {
    const supabasePackage = await getSupabaseSharePackageByToken(client, token);
    if (supabasePackage) return supabasePackage;
  } catch (error) {
    console.error("Failed to load share package", error);
  }

  try {
    const restPackage = await getSharePackageViaRest(token);
    if (restPackage) return restPackage;
  } catch (error) {
    console.error("Failed REST share package lookup", error);
  }

  return MOCK_SHARE_PACKAGES[token] ?? null;
}

function mapOwnerPackage(row: JsonRow): OwnerSharePackage {
  const token = asString(row.token) ?? "";
  return {
    id: asString(row.id) ?? token,
    token,
    title: asString(row.title) ?? "Shared Package",
    primaryJobId: asString(row.primary_job_id ?? row.primaryJobId),
    expiresAt: asIsoDate(row.expires_at ?? row.expiresAt, plusDaysIso(30)),
    isRevoked: asBoolean(row.is_revoked ?? row.isRevoked, false),
    allowDownload: asBoolean(row.allow_download ?? row.allowDownload, true),
    createdAt: asIsoDate(row.created_at ?? row.createdAt, new Date().toISOString()),
    url: buildShareUrl(token),
  };
}

export async function listOwnerSharePackages(jobId?: string): Promise<OwnerSharePackage[]> {
  let query = browserSupabase
    .from(SHARE_PACKAGE_TABLE)
    .select("id,token,title,primary_job_id,expires_at,is_revoked,allow_download,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (jobId) {
    query = query.eq("primary_job_id", jobId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as JsonRow[]).map(mapOwnerPackage);
}

export async function createOwnerSharePackage(input: {
  primaryJobId: string;
  title: string;
  address?: string;
  inspectorName?: string;
  expiresInDays?: number;
}): Promise<OwnerSharePackage> {
  const token = generateShareToken();
  const expiresAt = plusDaysIso(Math.max(1, input.expiresInDays ?? 30));
  const { data, error } = await browserSupabase
    .from(SHARE_PACKAGE_TABLE)
    .insert({
      token,
      title: input.title || "Inspection Share Package",
      address: input.address ?? null,
      inspector_name: input.inspectorName ?? null,
      primary_job_id: input.primaryJobId,
      expires_at: expiresAt,
      allow_download: true,
      is_revoked: false,
      assets: [],
      metadata: {},
    })
    .select("id,token,title,primary_job_id,expires_at,is_revoked,allow_download,created_at")
    .single();
  if (error) throw error;
  return mapOwnerPackage(data as JsonRow);
}

export async function updateOwnerSharePackage(
  token: string,
  patch: {
    isRevoked?: boolean;
    allowDownload?: boolean;
    expiresAt?: string;
  }
): Promise<void> {
  const nextPatch: Record<string, unknown> = {};
  if (typeof patch.isRevoked !== "undefined") nextPatch.is_revoked = patch.isRevoked;
  if (typeof patch.allowDownload !== "undefined") nextPatch.allow_download = patch.allowDownload;
  if (typeof patch.expiresAt !== "undefined") nextPatch.expires_at = patch.expiresAt;
  const { error } = await browserSupabase
    .from(SHARE_PACKAGE_TABLE)
    .update(nextPatch)
    .eq("token", token);
  if (error) throw error;
}

function isPdfAssetRow(row: JsonRow) {
  const type = asString(row.type)?.toLowerCase() ?? "";
  if (type === "pdf") return true;
  const label = asString(row.label)?.toLowerCase() ?? "";
  return label.includes("scope") || label.includes("report");
}

async function resolveAssetUrlWithBrowserClient(row: JsonRow): Promise<string | null> {
  const directUrl = asString(row.url) ?? asString(row.public_url);
  if (directUrl) return directUrl;
  const bucket = asString(row.bucket);
  const path = asString(row.path) ?? asString(row.storage_path) ?? asString(row.object_path);
  if (!bucket || !path) return null;
  const { data, error } = await browserSupabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function getDashboardReportActions(jobId: string): Promise<{
  reportUrl: string | null;
  shareUrl: string | null;
}> {
  const { data, error } = await browserSupabase
    .from(SHARE_PACKAGE_TABLE)
    .select("id,token,assets")
    .eq("primary_job_id", jobId)
    .eq("is_revoked", false)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as JsonRow[];
  if (!rows.length) {
    return { reportUrl: null, shareUrl: null };
  }

  const latestToken = asString(rows[0]?.token);
  const shareUrl = latestToken ? buildShareUrl(latestToken) : null;

  for (const packageRow of rows) {
    const inlineAssets = Array.isArray(packageRow.assets) ? packageRow.assets : [];
    for (const inline of inlineAssets) {
      if (!inline || typeof inline !== "object") continue;
      const assetRow = inline as JsonRow;
      if (!isPdfAssetRow(assetRow)) continue;
      const url = await resolveAssetUrlWithBrowserClient(assetRow);
      if (url) return { reportUrl: url, shareUrl };
    }

    const packageId = asString(packageRow.id);
    if (!packageId) continue;
    const { data: tableAssets, error: assetsError } = await browserSupabase
      .from(SHARE_ASSET_TABLE)
      .select("*")
      .eq(SHARE_ASSET_PACKAGE_ID_COLUMN, packageId)
      .order("sort_order", { ascending: true })
      .limit(200);
    if (assetsError || !Array.isArray(tableAssets)) continue;
    for (const asset of tableAssets as JsonRow[]) {
      if (!isPdfAssetRow(asset)) continue;
      const url = await resolveAssetUrlWithBrowserClient(asset);
      if (url) return { reportUrl: url, shareUrl };
    }
  }

  return { reportUrl: null, shareUrl };
}
