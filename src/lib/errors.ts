import { AdLibraryUrlError } from "./adlib/url";
import { AdLibraryScrapeError } from "./adlib/scraper";

/**
 * Boundary between internal failures and what an outside tester may see.
 *
 * Only errors we authored carry user-facing text; everything else (SQLite
 * errors, Playwright launch failures, filesystem errors) is replaced with a
 * generic message so no path, SQL statement or stack trace reaches the client.
 * The full error still goes to the server terminal.
 */

export class DuplicateMonitorError extends Error {}
export class ValidationError extends Error {}
export class DemoModeError extends Error {}

const SAFE_ERROR_TYPES = [
  AdLibraryUrlError,
  AdLibraryScrapeError,
  DuplicateMonitorError,
  ValidationError,
  DemoModeError,
];

export function isSafeError(error: unknown): error is Error {
  return SAFE_ERROR_TYPES.some((type) => error instanceof type);
}

export const GENERIC_ERROR_MESSAGE =
  "処理に失敗しました。しばらく待ってから再試行してください。";

/**
 * Returns a message safe to send to the browser, and logs the real one.
 * `context` is a short tag that makes the terminal log greppable.
 */
export function toPublicMessage(
  context: string,
  error: unknown,
  fallback: string = GENERIC_ERROR_MESSAGE,
): string {
  if (isSafeError(error)) {
    // Authored message: curated, contains no internal detail.
    console.warn(`[${context}] ${error.name}: ${error.message}`);
    return error.message;
  }
  console.error(`[${context}]`, error);
  return fallback;
}
