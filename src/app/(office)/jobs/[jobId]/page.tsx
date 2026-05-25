import { JobWorkspaceClient } from "./job-workspace-client";

type JobPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function JobPage({ params }: JobPageProps) {
  const { jobId } = await params;
  return <JobWorkspaceClient jobId={jobId} />;
}
