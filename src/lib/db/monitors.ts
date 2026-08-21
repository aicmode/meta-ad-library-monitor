import { randomUUID } from "node:crypto";
import { getDb } from "./client";
import type { Monitor } from "./types";
import { parseAdLibraryUrl } from "../adlib/url";

type MonitorRow = {
  id: string;
  name: string;
  ad_library_url: string;
  normalized_url: string;
  target_kind: string;
  target_key: string | null;
  country: string;
  enabled: number;
  created_at: string;
  last_checked_at: string | null;
  last_check_status: string | null;
  last_check_message: string | null;
};

function toMonitor(row: MonitorRow): Monitor {
  return {
    id: row.id,
    name: row.name,
    adLibraryUrl: row.ad_library_url,
    normalizedUrl: row.normalized_url,
    targetKind: row.target_kind as Monitor["targetKind"],
    targetKey: row.target_key,
    country: row.country,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    lastCheckedAt: row.last_checked_at,
    lastCheckStatus: row.last_check_status as Monitor["lastCheckStatus"],
    lastCheckMessage: row.last_check_message,
  };
}

export function listMonitors(): Monitor[] {
  const rows = getDb()
    .prepare("SELECT * FROM monitors ORDER BY created_at DESC")
    .all() as MonitorRow[];
  return rows.map(toMonitor);
}

export function getMonitor(id: string): Monitor | null {
  const row = getDb()
    .prepare("SELECT * FROM monitors WHERE id = ?")
    .get(id) as MonitorRow | undefined;
  return row ? toMonitor(row) : null;
}

export function createMonitor(input: {
  name: string;
  adLibraryUrl: string;
}): Monitor {
  // Throws AdLibraryUrlError for anything we can't scrape — surfaced to the UI.
  const target = parseAdLibraryUrl(input.adLibraryUrl);
  const id = randomUUID();

  getDb()
    .prepare(
      `INSERT INTO monitors
         (id, name, ad_library_url, normalized_url, target_kind, target_key, country, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      id,
      input.name.trim(),
      input.adLibraryUrl.trim(),
      target.normalizedUrl,
      target.kind,
      target.pageId ?? target.query ?? null,
      target.country,
      new Date().toISOString(),
    );

  return getMonitor(id)!;
}

export function setMonitorEnabled(id: string, enabled: boolean): Monitor | null {
  getDb()
    .prepare("UPDATE monitors SET enabled = ? WHERE id = ?")
    .run(enabled ? 1 : 0, id);
  return getMonitor(id);
}

export function deleteMonitor(id: string): void {
  getDb().prepare("DELETE FROM monitors WHERE id = ?").run(id);
}

export function recordCheckOutcome(
  id: string,
  status: "success" | "error",
  message: string | null,
): void {
  getDb()
    .prepare(
      `UPDATE monitors
          SET last_checked_at = ?, last_check_status = ?, last_check_message = ?
        WHERE id = ?`,
    )
    .run(new Date().toISOString(), status, message, id);
}
