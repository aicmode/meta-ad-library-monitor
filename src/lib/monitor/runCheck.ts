import { randomUUID } from "node:crypto";
import { getDb } from "../db/client";
import { getMonitor, recordCheckOutcome } from "../db/monitors";
import { upsertScrapedAds } from "../db/ads";
import { scrapeAdLibrary } from "../adlib/scraper";

export type CheckOutcome = {
  monitorId: string;
  monitorName: string;
  status: "success" | "error";
  fetched: number;
  newCount: number;
  existingCount: number;
  reportedTotal: number | null;
  warnings: string[];
  message: string | null;
  durationMs: number;
};

/**
 * Runs one monitor: scrape, diff against what we already stored, record the run.
 *
 * A failed scrape is recorded rather than thrown, so a broken monitor never
 * takes down a batch run and the reason stays visible in the UI.
 */
export async function runCheck(monitorId: string): Promise<CheckOutcome> {
  const monitor = getMonitor(monitorId);
  if (!monitor) throw new Error(`監視対象が見つかりません: ${monitorId}`);

  const db = getDb();
  const runId = randomUUID();
  const startedAt = Date.now();

  db.prepare(
    `INSERT INTO check_runs (id, monitor_id, started_at, status)
     VALUES (?, ?, ?, 'running')`,
  ).run(runId, monitorId, new Date().toISOString());

  const finish = (
    status: "success" | "error",
    fetched: number,
    newCount: number,
    message: string | null,
  ) => {
    db.prepare(
      `UPDATE check_runs
          SET finished_at = ?, status = ?, fetched_count = ?, new_count = ?, message = ?
        WHERE id = ?`,
    ).run(new Date().toISOString(), status, fetched, newCount, message, runId);
    recordCheckOutcome(monitorId, status, message);
  };

  try {
    const result = await scrapeAdLibrary(monitor.normalizedUrl);
    const diff = upsertScrapedAds(monitorId, result.ads);
    const message = `${diff.fetched}件取得 / 新規${diff.newCount}件`;
    finish("success", diff.fetched, diff.newCount, message);

    return {
      monitorId,
      monitorName: monitor.name,
      status: "success",
      fetched: diff.fetched,
      newCount: diff.newCount,
      existingCount: diff.existingCount,
      reportedTotal: result.reportedTotal,
      warnings: result.warnings,
      message,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finish("error", 0, 0, message);

    return {
      monitorId,
      monitorName: monitor.name,
      status: "error",
      fetched: 0,
      newCount: 0,
      existingCount: 0,
      reportedTotal: null,
      warnings: [],
      message,
      durationMs: Date.now() - startedAt,
    };
  }
}
