import { ReactNode } from "react";
import { OfficeShell } from "./office-shell";

export default function OfficeLayout({ children }: { children: ReactNode }) {
  return <OfficeShell>{children}</OfficeShell>;
}
