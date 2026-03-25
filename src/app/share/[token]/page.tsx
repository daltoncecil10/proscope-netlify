import { notFound } from "next/navigation";
import { ShareViewer } from "./share-viewer";
import { getSharePackageByToken } from "@/lib/share/provider";

type SharePageProps = {
  params: { token: string } | Promise<{ token: string }>;
};

export default async function ShareTokenPage({ params }: SharePageProps) {
  const resolvedParams = await Promise.resolve(params);
  const token = decodeURIComponent(resolvedParams?.token ?? "").trim();
  if (!token) {
    notFound();
  }

  const data = await getSharePackageByToken(token);

  if (!data) {
    notFound();
  }

  return <ShareViewer data={data} />;
}
