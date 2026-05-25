export type ShareAssetType = "image" | "video" | "pdf";
export type ShareAccessState = "active" | "expired" | "revoked";

export type ShareAsset = {
  id: string;
  label: string;
  section: string;
  type: ShareAssetType;
  url: string;
};

export type SharePackage = {
  token: string;
  title: string;
  address: string;
  inspectorName: string;
  insuredName: string | null;
  shareStructureLabel: string | null;
  createdAt: string;
  expiresAt: string;
  accessState: ShareAccessState;
  allowDownload: boolean;
  assets: ShareAsset[];
};

export type OwnerSharePackage = {
  id: string;
  token: string;
  title: string;
  primaryJobId: string | null;
  expiresAt: string;
  isRevoked: boolean;
  allowDownload: boolean;
  createdAt: string;
  url: string;
};
