import { JobWorkspaceClient } from "./workspace-client";

type JobPageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function JobDetailPage({ params }: JobPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const jobId = decodeURIComponent(resolvedParams?.id ?? "").trim();
  return <JobWorkspaceClient jobId={jobId} />;
}
