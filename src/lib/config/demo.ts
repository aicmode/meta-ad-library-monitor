/**
 * Demo-sharing configuration.
 *
 * The app has two modes:
 *   - DEMO_MODE unset / "false" → full local admin behaviour (unchanged MVP)
 *   - DEMO_MODE="true"          → hardened for sharing a URL with an outside
 *                                 tester: no destructive actions, tighter
 *                                 input limits, rate-limited scraping.
 *
 * Every limit lives here so the safe/unsafe boundary is reviewable in one file.
 */

/** Server-side only. Never trust a client-supplied value for this. */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export const DEMO_LIMITS = {
  /** A monitor cannot be re-checked until this long after its last check. */
  CHECK_COOLDOWN_MS: 60_000,
  /** Hard cap on monitors a demo tester can create, to bound Playwright load. */
  MAX_MONITORS: 30,
} as const;

/** Input limits. Applied in both modes — they only reject nonsense input. */
export const INPUT_LIMITS = {
  NAME_MAX_LENGTH: 80,
  URL_MAX_LENGTH: 1000,
} as const;

/** Cooldown actually applied in the current mode (0 = disabled locally). */
export function checkCooldownMs(): number {
  return isDemoMode() ? DEMO_LIMITS.CHECK_COOLDOWN_MS : 0;
}
