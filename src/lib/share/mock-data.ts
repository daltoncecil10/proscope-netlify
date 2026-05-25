import { SharePackage } from "@/lib/share/types";

export const MOCK_SHARE_PACKAGES: Record<string, SharePackage> = {
  "demo-claim-001": {
    token: "demo-claim-001",
    title: "Wind/Hail Inspection Package",
    address: "1428 Ridgeview Dr, Frisco, TX",
    inspectorName: "Dalton Cecil",
    insuredName: "Alex Morgan",
    shareStructureLabel: "Primary Dwelling",
    createdAt: "2026-03-15T19:10:00.000Z",
    expiresAt: "2026-04-14T19:10:00.000Z",
    accessState: "active",
    allowDownload: true,
    assets: [
      {
        id: "a1",
        label: "Front Elevation Overview",
        section: "Exterior - Front",
        type: "image",
        url: "/gallery/front-elevation.jpg",
      },
    ],
  },
};
