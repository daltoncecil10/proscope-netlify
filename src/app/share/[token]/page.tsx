import { notFound } from "next/navigation";
import { ShareViewer } from "./share-viewer";
import { getSharePackageByToken } from "@/lib/share/provider";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export default async function ShareTokenPage({ params }: SharePageProps) {
  const { token } = await params;
  const data = await getSharePackageByToken(token);

  if (!data) {
    notFound();
  }

  return <ShareViewer data={data} />;
}
