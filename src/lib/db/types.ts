import type { AdMedia } from "../adlib/types";

export type Monitor = {
  id: string;
  name: string;
  adLibraryUrl: string;
  normalizedUrl: string;
  targetKind: "page" | "keyword";
  targetKey: string | null;
  country: string;
  enabled: boolean;
  createdAt: string;
  lastCheckedAt: string | null;
  lastCheckStatus: "success" | "error" | null;
  lastCheckMessage: string | null;
};

export type Ad = {
  id: string;
  monitorId: string;
  dedupeKey: string;
  adArchiveId: string | null;
  advertiserName: string | null;
  pageId: string | null;
  bodyText: string | null;
  startDate: string | null;
  snapshotUrl: string | null;
  destinationUrl: string | null;
  isActive: boolean;
  media: AdMedia[];
  firstSeenAt: string;
  lastSeenAt: string;
  isNew: boolean;
  timesSeen: number;
};

export type AdWithMonitor = Ad & { monitorName: string };

export type CheckRun = {
  id: string;
  monitorId: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "error";
  fetchedCount: number;
  newCount: number;
  message: string | null;
};
