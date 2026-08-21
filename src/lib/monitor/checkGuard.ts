import { checkCooldownMs } from "../config/demo";

/**
 * Guards manual checks against double-clicks and impatient re-runs.
 *
 * Two separate protections:
 *   1. A per-monitor mutex, so a second request for a monitor already being
 *      scraped is rejected instead of launching another Chromium.
 *   2. A cooldown (demo mode only), so the same monitor cannot be re-scraped
 *      immediately after a finished run.
 *
 * This is deliberately in-process: the demo runs as a single Node instance and
 * the requirement is to stop accidental hammering, not to build a distributed
 * queue. State is parked on globalThis so Next.js hot reload in dev doesn't
 * silently reset the locks mid-session.
 */

type GuardState = {
  running: Set<string>;
  lastFinishedAt: Map<string, number>;
};

const globalRef = globalThis as typeof globalThis & {
  __adMonitorCheckGuard?: GuardState;
};

const state: GuardState = (globalRef.__adMonitorCheckGuard ??= {
  running: new Set<string>(),
  lastFinishedAt: new Map<string, number>(),
});

export type GuardRejection =
  | { ok: false; reason: "running"; message: string; retryAfterSec: number }
  | { ok: false; reason: "cooldown"; message: string; retryAfterSec: number };

export type GuardResult = { ok: true; release: () => void } | GuardRejection;

export function isCheckRunning(monitorId: string): boolean {
  return state.running.has(monitorId);
}

/**
 * Attempts to take the lock for one monitor.
 *
 * `lastCheckedAt` comes from the database so the cooldown survives a restart —
 * the in-memory timestamp alone would be cleared by a redeploy.
 */
export function acquireCheckSlot(
  monitorId: string,
  lastCheckedAt: string | null,
): GuardResult {
  if (state.running.has(monitorId)) {
    return {
      ok: false,
      reason: "running",
      message: "この監視対象は現在取得中です。完了までお待ちください。",
      retryAfterSec: 30,
    };
  }

  const cooldown = checkCooldownMs();
  if (cooldown > 0) {
    const persisted = lastCheckedAt ? Date.parse(lastCheckedAt) : NaN;
    const inMemory = state.lastFinishedAt.get(monitorId) ?? 0;
    const last = Math.max(Number.isNaN(persisted) ? 0 : persisted, inMemory);
    const elapsed = Date.now() - last;

    if (last > 0 && elapsed < cooldown) {
      const retryAfterSec = Math.ceil((cooldown - elapsed) / 1000);
      return {
        ok: false,
        reason: "cooldown",
        message: `直前にチェック済みです。あと約${retryAfterSec}秒お待ちください。`,
        retryAfterSec,
      };
    }
  }

  state.running.add(monitorId);
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      state.running.delete(monitorId);
      state.lastFinishedAt.set(monitorId, Date.now());
    },
  };
}
