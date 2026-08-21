#!/usr/bin/env node
/**
 * Local-only database reset.
 *
 * This is the one destructive operation in the repo. It is a CLI script, not
 * reachable from the web UI, and it refuses to run when DEMO_MODE=true so a
 * demo deployment cannot wipe its own data even if the script is invoked.
 */
import { rmSync } from "node:fs";

if (process.env.DEMO_MODE === "true") {
  console.error(
    "DEMO_MODE=true のため db:reset は実行できません。デモ環境のデータは削除しません。",
  );
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH || "data/monitor.db";
for (const suffix of ["", "-shm", "-wal"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}
console.log(`削除しました: ${dbPath} (+ -shm / -wal)`);
