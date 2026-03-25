export type DashboardJob = {
  id: string;
  title: string;
  address: string;
  status: string | null;
  notes: string | null;
  scheduled_at: string | null;
  updated_at: string | null;
};

export type DashboardPhoto = {
  id: string;
  job_id: string;
  storage_path: string;
  category: string | null;
  caption: string | null;
  created_at: string | null;
  signed_url: string | null;
};
