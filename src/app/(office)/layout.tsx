import { OfficeAuthProvider } from "@/contexts/OfficeAuthContext";

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return <OfficeAuthProvider>{children}</OfficeAuthProvider>;
}
