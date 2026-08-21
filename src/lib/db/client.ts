import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * SQLite is deliberately hidden behind the repository modules in this folder
 * so the storage engine can be swapped (e.g. for Supabase/Postgres) without
 * touching route handlers or UI code.
 */

const DB_PATH = process.env.DATABASE_PATH || "data/monitor.db";

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      ad_library_url     TEXT NOT NULL,
      normalized_url     TEXT NOT NULL,
      target_kind        TEXT NOT NULL,
      target_key         TEXT,
      country            TEXT NOT NULL DEFAULT 'JP',
      enabled            INTEGER NOT NULL DEFAULT 1,
      created_at         TEXT NOT NULL,
      last_checked_at    TEXT,
      last_check_status  TEXT,
      last_check_message TEXT
    );

    CREATE TABLE IF NOT EXISTS ads (
      id              TEXT PRIMARY KEY,
      monitor_id      TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      -- Library ID when Meta exposes one, otherwise a content fingerprint.
      dedupe_key      TEXT NOT NULL,
      ad_archive_id   TEXT,
      advertiser_name TEXT,
      page_id         TEXT,
      body_text       TEXT,
      start_date      TEXT,
      snapshot_url    TEXT,
      destination_url TEXT,
      is_active       INTEGER NOT NULL DEFAULT 1,
      media_json      TEXT NOT NULL DEFAULT '[]',
      first_seen_at   TEXT NOT NULL,
      last_seen_at    TEXT NOT NULL,
      is_new          INTEGER NOT NULL DEFAULT 1,
      times_seen      INTEGER NOT NULL DEFAULT 1
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ads_monitor_dedupe
      ON ads (monitor_id, dedupe_key);
    CREATE INDEX IF NOT EXISTS ads_first_seen ON ads (first_seen_at DESC);
    CREATE INDEX IF NOT EXISTS ads_is_new ON ads (is_new);

    CREATE TABLE IF NOT EXISTS check_runs (
      id            TEXT PRIMARY KEY,
      monitor_id    TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      started_at    TEXT NOT NULL,
      finished_at   TEXT,
      status        TEXT NOT NULL,
      fetched_count INTEGER NOT NULL DEFAULT 0,
      new_count     INTEGER NOT NULL DEFAULT 0,
      message       TEXT
    );

    CREATE INDEX IF NOT EXISTS check_runs_monitor ON check_runs (monitor_id, started_at DESC);
  `);
}
