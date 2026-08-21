import { randomUUID } from "node:crypto";
import { getDb } from "./client";
import type { Monitor } from "./types";
import { parseAdLibraryUrl } from "../adlib/url";
import { INPUT_LIMITS } from "../config/demo";
import { DuplicateMonitorError, ValidationError } from "../errors";

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

export function countMonitors(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM monitors")
    .get() as { n: number };
  return row.n;
}

/**
 * Looks up an existing monitor by its *normalised* URL, so two paste-ins of
 * the same target that differ only in query-string order or tracking params
 * still collide.
 */
export function findMonitorByNormalizedUrl(
  normalizedUrl: string,
): Monitor | null {
  const row = getDb()
    .prepare("SELECT * FROM monitors WHERE normalized_url = ?")
    .get(normalizedUrl) as MonitorRow | undefined;
  return row ? toMonitor(row) : null;
}

/** Trims and rejects blank / oversized advertiser names. */
export function validateMonitorName(raw: string | undefined): string {
  const name = (raw ?? "").trim();
  if (!name) throw new ValidationError("広告主名を入力してください。");
  if (name.length > INPUT_LIMITS.NAME_MAX_LENGTH) {
    throw new ValidationError(
      `広告主名は${INPUT_LIMITS.NAME_MAX_LENGTH}文字以内で入力してください。`,
    );
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    throw new ValidationError("広告主名に使用できない文字が含まれています。");
  }
  return name;
}

export function createMonitor(input: {
  name: string;
  adLibraryUrl: string;
}): Monitor {
  const name = validateMonitorName(input.name);
  // Throws AdLibraryUrlError for anything we can't scrape — surfaced to the UI.
  const target = parseAdLibraryUrl(input.adLibraryUrl);

  const existing = findMonitorByNormalizedUrl(target.normalizedUrl);
  if (existing) {
    throw new DuplicateMonitorError(
      `このURLはすでに「${existing.name}」として登録されています。`,
    );
  }

  const id = randomUUID();

  try {
    getDb()
      .prepare(
        `INSERT INTO monitors
           (id, name, ad_library_url, normalized_url, target_kind, target_key, country, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .run(
        id,
        name,
        input.adLibraryUrl.trim(),
        target.normalizedUrl,
        target.kind,
        target.pageId ?? target.query ?? null,
        target.country,
        new Date().toISOString(),
      );
  } catch (error) {
    // Race between the check above and the insert: the unique index catches it.
    if (
      error instanceof Error &&
      /UNIQUE constraint failed/i.test(error.message)
    ) {
      throw new DuplicateMonitorError("このURLはすでに登録されています。");
    }
    throw error;
  }

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
