import { SharePackage } from "@/lib/share/types";

export const MOCK_SHARE_PACKAGES: Record<string, SharePackage> = {
  "demo-claim-001": {
    token: "demo-claim-001",
    title: "Wind/Hail Inspection Package",
    address: "1428 Ridgeview Dr, Frisco, TX",
    inspectorName: "Dalton Cecil",
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
        url: "/gallery/front-elevation.jpg"
      },
      {
        id: "a2",
        label: "Rear Elevation Overview",
        section: "Exterior - Rear",
        type: "image",
        url: "/gallery/rear-elevation.jpg"
      },
      {
        id: "a3",
        label: "Roof Slope 1 Damage",
        section: "Roof",
        type: "image",
        url: "/gallery/roof-slope-1.jpg"
      },
      {
        id: "a4",
        label: "Overview Walkthrough Clip",
        section: "Video",
        type: "video",
        url: "/media/hero.mp4"
      }
    ]
  }
};
