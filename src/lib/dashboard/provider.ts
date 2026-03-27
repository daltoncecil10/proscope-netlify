import { supabase } from "@/lib/supabase/client";
import type {
  DashboardDocument,
  DashboardJob,
  DashboardPhoto,
} from "@/lib/dashboard/types";

const JOB_FILES_BUCKET = "job-files";
const JOB_DOCUMENTS_TABLE = "job_documents";

export async function listDashboardJobs(): Promise<DashboardJob[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,title,address,status,notes,scheduled_at,updated_at")
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data ?? []) as DashboardJob[];
}

export async function checkDashboardJobCreateSupport(): Promise<boolean> {
  const { error } = await supabase
    .from("jobs")
    .select("id,title,address,notes,scheduled_at")
    .limit(1);
  return !error;
}

export async function createDashboardJob(input: {
  title: string;
  address: string;
  notes?: string | null;
  scheduledAt?: string | null;
}): Promise<DashboardJob> {
  // Keep creation payload minimal so web uses the same shared job shape.
  const payload = {
    title: input.title.trim(),
    address: input.address.trim(),
    notes: input.notes?.trim() ? input.notes.trim() : null,
    scheduled_at: input.scheduledAt ?? null,
  };

  const { data, error } = await supabase
    .from("jobs")
    .insert(payload)
    .select("id,title,address,status,notes,scheduled_at,updated_at")
    .single();

  if (error) throw error;
  return data as DashboardJob;
}

export async function updateDashboardJob(
  jobId: string,
  patch: {
    title?: string;
    address?: string;
    status?: string | null;
    notes?: string | null;
    scheduled_at?: string | null;
  }
) {
  const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);
  if (error) throw error;
}

export async function archiveDashboardJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({ archived: true })
    .eq("id", jobId);
  if (error) throw error;
}

export async function listDashboardPhotos(jobId: string): Promise<DashboardPhoto[]> {
  const { data, error } = await supabase
    .from("attachment_photos")
    .select("id,job_id,storage_path,category,caption,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) throw error;

  const rows = (data ?? []) as DashboardPhoto[];
  const withSignedUrls = await Promise.all(
    rows.map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from(JOB_FILES_BUCKET)
        .createSignedUrl(photo.storage_path, 60 * 60);
      return { ...photo, signed_url: signed?.signedUrl ?? null };
    })
  );

  return withSignedUrls;
}

export async function updateDashboardPhoto(
  photoId: string,
  patch: { caption?: string | null; category?: string | null }
) {
  const nextPatch: Record<string, string | null> = {};
  if (typeof patch.caption !== "undefined") nextPatch.caption = patch.caption;
  if (typeof patch.category !== "undefined") nextPatch.category = patch.category;

  const { error } = await supabase
    .from("attachment_photos")
    .update(nextPatch)
    .eq("id", photoId);

  if (error) throw error;
}

export async function deleteDashboardPhoto(photo: {
  id: string;
  storagePath: string;
}): Promise<void> {
  const { error: rowError } = await supabase
    .from("attachment_photos")
    .delete()
    .eq("id", photo.id);
  if (rowError) throw rowError;

  const { error: storageError } = await supabase.storage
    .from(JOB_FILES_BUCKET)
    .remove([photo.storagePath]);
  if (storageError) throw storageError;
}

export async function checkDocumentsSupport(): Promise<boolean> {
  const { error } = await supabase
    .from(JOB_DOCUMENTS_TABLE)
    .select("id")
    .limit(1);
  return !error;
}

export async function listDashboardDocuments(jobId: string): Promise<DashboardDocument[]> {
  const { data, error } = await supabase
    .from(JOB_DOCUMENTS_TABLE)
    .select("id,job_id,storage_path,file_name,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const rows = (data ?? []) as DashboardDocument[];
  const withUrls = await Promise.all(
    rows.map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from(JOB_FILES_BUCKET)
        .createSignedUrl(doc.storage_path, 60 * 60);
      return { ...doc, signed_url: signed?.signedUrl ?? null };
    })
  );

  return withUrls;
}

export async function uploadDashboardDocument(input: {
  jobId: string;
  file: File;
}): Promise<void> {
  const cleanedFileName = input.file.name.replace(/[^\w.-]+/g, "_");
  const storagePath = `${input.jobId}/documents/${Date.now()}-${cleanedFileName}`;
  const { error: uploadError } = await supabase.storage
    .from(JOB_FILES_BUCKET)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: input.file.type || "application/octet-stream",
    });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from(JOB_DOCUMENTS_TABLE).insert({
    job_id: input.jobId,
    storage_path: storagePath,
    file_name: input.file.name,
  });
  if (insertError) throw insertError;
}

export async function deleteDashboardDocument(doc: {
  id: string;
  storagePath: string;
}): Promise<void> {
  const { error: rowError } = await supabase
    .from(JOB_DOCUMENTS_TABLE)
    .delete()
    .eq("id", doc.id);
  if (rowError) throw rowError;

  const { error: storageError } = await supabase.storage
    .from(JOB_FILES_BUCKET)
    .remove([doc.storagePath]);
  if (storageError) throw storageError;
}
