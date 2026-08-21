/**
 * Helpers for validating and normalising the Ad Library URLs a user registers.
 *
 * Users are expected to paste the URL straight out of their browser after
 * searching in the Ad Library, so we accept both shapes Meta produces:
 *   - advertiser-scoped: ?view_all_page_id=<id>&search_type=page
 *   - keyword search:    ?q=<terms>&search_type=keyword_unordered
 */

import { INPUT_LIMITS } from "../config/demo";

export type AdLibraryTarget = {
  kind: "page" | "keyword";
  /** Advertiser page id, for kind === "page". */
  pageId?: string;
  /** Search terms, for kind === "keyword". */
  query?: string;
  country: string;
  /** URL normalised for scraping (forces active_status/media_type defaults). */
  normalizedUrl: string;
};

export class AdLibraryUrlError extends Error {}

const AD_LIBRARY_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
]);

/**
 * Parses an Ad Library URL into a scrape target.
 * Throws AdLibraryUrlError with a user-facing message when it isn't usable.
 */
export function parseAdLibraryUrl(input: string): AdLibraryTarget {
  const trimmed = input.trim();
  if (!trimmed) throw new AdLibraryUrlError("URLを入力してください。");

  if (trimmed.length > INPUT_LIMITS.URL_MAX_LENGTH) {
    throw new AdLibraryUrlError(
      `URLが長すぎます（${INPUT_LIMITS.URL_MAX_LENGTH}文字以内）。`,
    );
  }
  // Control characters can smuggle line breaks past logging/DOM sinks.
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new AdLibraryUrlError("URLに使用できない文字が含まれています。");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AdLibraryUrlError("URLの形式が正しくありません。");
  }

  // Reject javascript:, data:, file: and every other non-web scheme before
  // anything else looks at the value.
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AdLibraryUrlError(
      "http / https 以外のURLは登録できません。",
    );
  }

  if (!AD_LIBRARY_HOSTS.has(url.hostname)) {
    throw new AdLibraryUrlError(
      "facebook.com の広告ライブラリURLを指定してください。",
    );
  }
  if (!url.pathname.startsWith("/ads/library")) {
    throw new AdLibraryUrlError(
      "広告ライブラリのURL（/ads/library/...）を指定してください。",
    );
  }

  const params = url.searchParams;
  const country = (params.get("country") || "JP").toUpperCase();
  const pageId = params.get("view_all_page_id");
  const query = params.get("q");

  // Rebuild rather than mutate, so registered URLs always scrape consistently.
  const out = new URL("https://www.facebook.com/ads/library/");
  out.searchParams.set("active_status", params.get("active_status") || "active");
  out.searchParams.set("ad_type", params.get("ad_type") || "all");
  out.searchParams.set("country", country);
  out.searchParams.set("media_type", params.get("media_type") || "all");

  if (pageId) {
    if (!/^\d+$/.test(pageId)) {
      throw new AdLibraryUrlError("view_all_page_id が数値ではありません。");
    }
    out.searchParams.set("view_all_page_id", pageId);
    out.searchParams.set("search_type", "page");
    return { kind: "page", pageId, country, normalizedUrl: out.toString() };
  }

  if (query) {
    if (query.trim().length === 0) {
      throw new AdLibraryUrlError("検索キーワード（q）が空です。");
    }
    if (query.length > 200) {
      throw new AdLibraryUrlError("検索キーワード（q）が長すぎます。");
    }
    out.searchParams.set("q", query);
    out.searchParams.set(
      "search_type",
      params.get("search_type") || "keyword_unordered",
    );
    return { kind: "keyword", query, country, normalizedUrl: out.toString() };
  }

  throw new AdLibraryUrlError(
    "広告主（view_all_page_id）またはキーワード（q）を含むURLを指定してください。",
  );
}

/** Canonical permalink for a single ad, built from its Library ID. */
export function snapshotUrlForAdArchiveId(adArchiveId: string): string {
  return `https://www.facebook.com/ads/library/?id=${adArchiveId}`;
}

/** Unwraps Meta's l.facebook.com redirector to the real destination URL. */
export function unwrapFacebookLink(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.hostname.endsWith("facebook.com") && u.pathname === "/l.php") {
      const target = u.searchParams.get("u");
      if (target) return target;
    }
    if (u.hostname.endsWith("facebook.com")) return null;
    return href;
  } catch {
    return null;
  }
}
