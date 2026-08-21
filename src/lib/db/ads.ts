import { createHash, randomUUID } from "node:crypto";
import { getDb } from "./client";
import type { Ad, AdWithMonitor } from "./types";
import type { AdMedia, ScrapedAd } from "../adlib/types";

type AdRow = {
  id: string;
  monitor_id: string;
  dedupe_key: string;
  ad_archive_id: string | null;
  advertiser_name: string | null;
  page_id: string | null;
  body_text: string | null;
  start_date: string | null;
  snapshot_url: string | null;
  destination_url: string | null;
  is_active: number;
  media_json: string;
  first_seen_at: string;
  last_seen_at: string;
  is_new: number;
  times_seen: number;
  monitor_name?: string;
};

function toAd(row: AdRow): AdWithMonitor {
  let media: AdMedia[] = [];
  try {
    media = JSON.parse(row.media_json) as AdMedia[];
  } catch {
    media = [];
  }
  return {
    id: row.id,
    monitorId: row.monitor_id,
    dedupeKey: row.dedupe_key,
    adArchiveId: row.ad_archive_id,
    advertiserName: row.advertiser_name,
    pageId: row.page_id,
    bodyText: row.body_text,
    startDate: row.start_date,
    snapshotUrl: row.snapshot_url,
    destinationUrl: row.destination_url,
    isActive: row.is_active === 1,
    media,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    isNew: row.is_new === 1,
    timesSeen: row.times_seen,
    monitorName: row.monitor_name ?? "",
  };
}

/**
 * Identity key for an ad within one monitor.
 *
 * Meta's "Library ID" is stable across checks, so it's the primary key when
 * present. When a card doesn't expose one we fall back to a hash of the
 * content that defines the ad, which is stable as long as the copy and start
 * date don't change.
 */
export function buildDedupeKey(ad: ScrapedAd, monitorId: string): string {
  if (ad.adArchiveId) return `lib:${ad.adArchiveId}`;
  const fingerprint = createHash("sha256")
    .update(
      [
        monitorId,
        ad.advertiserName ?? "",
        ad.bodyText ?? "",
        ad.startDate ?? "",
        ad.destinationUrl ?? "",
      ].join(" "),
    )
    .digest("hex")
    .slice(0, 32);
  return `fp:${fingerprint}`;
}

export type DiffResult = {
  fetched: number;
  newCount: number;
  existingCount: number;
  newAdIds: string[];
};

/**
 * Persists a scrape result and classifies each ad as NEW or existing.
 *
 * An ad is marked NEW the first time we ever see it. The next check that sees
 * it again clears the flag, so the same ad is never reported as NEW twice.
 */
export function upsertScrapedAds(
  monitorId: string,
  scraped: ScrapedAd[],
): DiffResult {
  const db = getDb();
  const now = new Date().toISOString();

  const findExisting = db.prepare(
    "SELECT id FROM ads WHERE monitor_id = ? AND dedupe_key = ?",
  );
  const insert = db.prepare(
    `INSERT INTO ads
       (id, monitor_id, dedupe_key, ad_archive_id, advertiser_name, page_id,
        body_text, start_date, snapshot_url, destination_url, is_active,
        media_json, first_seen_at, last_seen_at, is_new, times_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
  );
  // Seeing an ad again confirms it is no longer new.
  const update = db.prepare(
    `UPDATE ads
        SET last_seen_at = ?, is_new = 0, times_seen = times_seen + 1,
            is_active = ?, media_json = ?, body_text = COALESCE(?, body_text),
            destination_url = COALESCE(?, destination_url)
      WHERE id = ?`,
  );

  const result: DiffResult = {
    fetched: scraped.length,
    newCount: 0,
    existingCount: 0,
    newAdIds: [],
  };

  const run = db.transaction((ads: ScrapedAd[]) => {
    const seenThisRun = new Set<string>();

    for (const ad of ads) {
      const dedupeKey = buildDedupeKey(ad, monitorId);
      // Meta occasionally renders the same ad twice in one result set.
      if (seenThisRun.has(dedupeKey)) continue;
      seenThisRun.add(dedupeKey);

      const existing = findExisting.get(monitorId, dedupeKey) as
        | { id: string }
        | undefined;
      const mediaJson = JSON.stringify(ad.media);

      if (existing) {
        update.run(
          now,
          ad.isActive ? 1 : 0,
          mediaJson,
          ad.bodyText,
          ad.destinationUrl,
          existing.id,
        );
        result.existingCount++;
      } else {
        const id = randomUUID();
        insert.run(
          id,
          monitorId,
          dedupeKey,
          ad.adArchiveId,
          ad.advertiserName,
          ad.pageId,
          ad.bodyText,
          ad.startDate,
          ad.snapshotUrl,
          ad.destinationUrl,
          ad.isActive ? 1 : 0,
          mediaJson,
          now,
          now,
        );
        result.newCount++;
        result.newAdIds.push(id);
      }
    }
  });

  run(scraped);
  return result;
}

export function listAds(filter: {
  monitorId?: string;
  onlyNew?: boolean;
  limit?: number;
}): AdWithMonitor[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.monitorId) {
    where.push("a.monitor_id = ?");
    params.push(filter.monitorId);
  }
  if (filter.onlyNew) where.push("a.is_new = 1");

  const sql = `
    SELECT a.*, m.name AS monitor_name
      FROM ads a
      JOIN monitors m ON m.id = a.monitor_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY a.is_new DESC, a.first_seen_at DESC
     LIMIT ?`;
  params.push(filter.limit ?? 200);

  const rows = getDb().prepare(sql).all(...params) as AdRow[];
  return rows.map(toAd);
}

export type DashboardStats = {
  monitorCount: number;
  enabledMonitorCount: number;
  totalAds: number;
  newAds: number;
  lastCheckedAt: string | null;
};

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const monitors = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled,
              MAX(last_checked_at) AS last_checked
         FROM monitors`,
    )
    .get() as {
    total: number;
    enabled: number | null;
    last_checked: string | null;
  };
  const ads = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_new = 1 THEN 1 ELSE 0 END) AS new_count
         FROM ads`,
    )
    .get() as { total: number; new_count: number | null };

  return {
    monitorCount: monitors.total,
    enabledMonitorCount: monitors.enabled ?? 0,
    totalAds: ads.total,
    newAds: ads.new_count ?? 0,
    lastCheckedAt: monitors.last_checked,
  };
}

export type { Ad, AdWithMonitor };
