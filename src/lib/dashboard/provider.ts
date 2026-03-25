import { supabase } from "@/lib/supabase/client";
import type { DashboardJob, DashboardPhoto } from "@/lib/dashboard/types";

const JOB_FILES_BUCKET = "job-files";

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

export async function updateDashboardJob(
  jobId: string,
  patch: {
    title?: string;
    address?: string;
    status?: string | null;
    notes?: string | null;
  }
) {
  const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);
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
