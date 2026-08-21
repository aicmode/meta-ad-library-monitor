import type { Browser } from "playwright";
import type { ScrapeOptions, ScrapeResult, ScrapedAd } from "./types";
import {
  parseAdLibraryUrl,
  snapshotUrlForAdArchiveId,
  unwrapFacebookLink,
} from "./url";

/**
 * Scrapes the public Meta Ad Library web UI with a real browser.
 *
 * Why a browser and not the official API: the Graph API `ads_archive`
 * endpoint only returns non-political ads that reached the EU, so ordinary
 * Japanese commercial ads are out of scope for it entirely. See
 * docs/DATA_ACQUISITION.md for the full validation write-up.
 *
 * This reads the same publicly accessible pages a logged-out visitor sees.
 * It does not log in, does not solve or bypass CAPTCHAs, and does not defeat
 * bot detection; if Meta serves an interstitial instead of results we report
 * that as a failure rather than working around it. Requests are paced with
 * deliberate delays to keep load low.
 */

/** The UI locale we force, so labels and dates parse deterministically. */
const SCRAPE_LOCALE = "en-US";

const DEFAULTS = {
  maxAds: 60,
  maxScrolls: 6,
  headless: true,
  settleMs: 9000,
} satisfies Required<ScrapeOptions>;

/** Pause between scroll rounds, to avoid hammering the page. */
const SCROLL_PAUSE_MS = 2500;

export class AdLibraryScrapeError extends Error {}

export async function scrapeAdLibrary(
  adLibraryUrl: string,
  options: ScrapeOptions = {},
): Promise<ScrapeResult> {
  const opts = { ...DEFAULTS, ...options };
  const target = parseAdLibraryUrl(adLibraryUrl);
  const warnings: string[] = [];

  const { chromium } = await import("playwright");
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ headless: opts.headless });
    const context = await browser.newContext({
      locale: SCRAPE_LOCALE,
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
      viewport: { width: 1500, height: 1100 },
    });
    const page = await context.newPage();

    await page.goto(target.normalizedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // The results grid is rendered client-side after the shell loads.
    await page.waitForTimeout(opts.settleMs);

    const bodyText = await page.locator("body").innerText();
    if (!bodyText.includes("Library ID")) {
      if (/No ads match your search criteria/i.test(bodyText)) {
        return { ads: [], reportedTotal: 0, warnings };
      }
      if (/log in|Log In/i.test(bodyText) && bodyText.length < 1500) {
        throw new AdLibraryScrapeError(
          "広告ライブラリがログイン画面または制限ページを返しました。時間をおいて再試行してください。",
        );
      }
      throw new AdLibraryScrapeError(
        "広告カードを検出できませんでした。URLまたはMeta側の表示仕様を確認してください。",
      );
    }

    // Scroll to pull in more results until we have enough or the count stalls.
    let previousCount = await countCards(page);
    for (let i = 0; i < opts.maxScrolls; i++) {
      if (previousCount >= opts.maxAds) break;
      await page.mouse.wheel(0, 20_000);
      await page.waitForTimeout(SCROLL_PAUSE_MS);
      const nextCount = await countCards(page);
      if (nextCount === previousCount) break; // no more results loading
      previousCount = nextCount;
    }

    const pageId =
      target.kind === "page" ? target.pageId! : await resolvePageId(page);

    const raw = await extractCards(page, opts.maxAds);
    const reportedTotal = parseReportedTotal(bodyText);

    const ads = raw.map((card) => toScrapedAd(card, pageId));
    const withoutId = ads.filter((a) => !a.adArchiveId).length;
    if (withoutId > 0) {
      warnings.push(
        `${withoutId}件の広告でLibrary IDを取得できず、フィンガープリントで識別します。`,
      );
    }

    return { ads, reportedTotal, warnings };
  } finally {
    await browser?.close();
  }
}

type RawCard = {
  adArchiveId: string | null;
  text: string;
  images: string[];
  videos: { src: string | null; poster: string | null }[];
  links: string[];
};

function countCards(page: import("playwright").Page): Promise<number> {
  return page.evaluate(
    () => (document.body.innerText.match(/Library ID/g) || []).length,
  );
}

/**
 * Ad Library renders each ad as a card; there is no stable class name to hook
 * onto, so we anchor on the "Library ID" label and walk up to the nearest
 * element large enough to be the card itself.
 */
function extractCards(
  page: import("playwright").Page,
  maxAds: number,
): Promise<RawCard[]> {
  return page.evaluate((limit) => {
    const results: RawCard[] = [];
    const seen = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (results.length >= limit) break;
      const match = node.textContent?.match(/Library ID:?\s*(\d+)/);
      if (!match) continue;
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);

      let el = node.parentElement as HTMLElement | null;
      let card: HTMLElement | null = null;
      for (let i = 0; i < 12 && el; i++) {
        if (el.offsetHeight > 250 && el.offsetWidth > 250) {
          card = el;
          break;
        }
        el = el.parentElement;
      }
      if (!card) continue;
      // Climb a little further to capture the creative/media area.
      for (
        let i = 0;
        i < 3 &&
        card.parentElement &&
        card.parentElement.offsetHeight < card.offsetHeight * 1.4;
        i++
      ) {
        card = card.parentElement;
      }

      results.push({
        adArchiveId: id,
        text: card.innerText,
        images: Array.from(card.querySelectorAll("img"))
          .map((i) => (i as HTMLImageElement).src)
          .filter((s) => s && !s.startsWith("data:")),
        videos: Array.from(card.querySelectorAll("video")).map((v) => ({
          src: (v as HTMLVideoElement).src || null,
          poster: (v as HTMLVideoElement).poster || null,
        })),
        links: Array.from(card.querySelectorAll("a")).map(
          (a) => (a as HTMLAnchorElement).href,
        ),
      });
    }
    return results;
  }, maxAds) as Promise<RawCard[]>;
}

/** Best-effort page id for keyword monitors, read from the embedded payload. */
async function resolvePageId(
  page: import("playwright").Page,
): Promise<string | null> {
  const html = await page.content();
  const match = html.match(/"page_id":"?(\d{8,20})"?/);
  return match ? match[1] : null;
}

function parseReportedTotal(bodyText: string): number | null {
  const match = bodyText.match(/~?([\d,]+)\s+results/i);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toScrapedAd(card: RawCard, fallbackPageId: string | null): ScrapedAd {
  const lines = card.text
    .split("\n")
    .map((l) => l.replace(/​/g, "").trim())
    .filter((l) => l.length > 0);

  return {
    adArchiveId: card.adArchiveId,
    advertiserName: parseAdvertiser(lines),
    pageId: fallbackPageId,
    bodyText: parseBody(lines),
    startDate: parseStartDate(card.text),
    isActive: /^\s*Active\s*$/m.test(card.text),
    snapshotUrl: card.adArchiveId
      ? snapshotUrlForAdArchiveId(card.adArchiveId)
      : null,
    destinationUrl: parseDestination(card.links),
    media: parseMedia(card),
    rawText: card.text,
  };
}

/** The advertiser name is the line directly above the "Sponsored" label. */
function parseAdvertiser(lines: string[]): string | null {
  const idx = lines.findIndex((l) => l === "Sponsored");
  if (idx > 0) return lines[idx - 1];
  return null;
}

/**
 * Body copy runs from just after "Sponsored" until the link preview begins.
 * Meta renders the link preview's domain in caps (e.g. "WWW.KANGO-ROO.COM"),
 * which is the most reliable boundary marker available.
 */
function parseBody(lines: string[]): string | null {
  const start = lines.findIndex((l) => l === "Sponsored");
  if (start === -1) return null;

  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[A-Z0-9][A-Z0-9.\-]*\.[A-Z]{2,}$/.test(line)) break; // domain caption
    if (/^\d+:\d{2}\s*\/\s*\d+:\d{2}$/.test(line)) break; // video scrubber
    if (line === "Learn More" || line === "Shop Now" || line === "Sign Up") break;
    body.push(line);
  }
  const text = body.join("\n").trim();
  return text.length > 0 ? text : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parses "Started running on Apr 20, 2026" into an ISO date. */
function parseStartDate(text: string): string | null {
  const match = text.match(
    /Started running on\s+([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/,
  );
  if (!match) return null;
  const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
  if (!month) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDestination(links: string[]): string | null {
  for (const href of links) {
    const unwrapped = unwrapFacebookLink(href);
    if (unwrapped) return unwrapped;
  }
  return null;
}

/**
 * Keeps the largest rendition of each creative and drops the advertiser's
 * small profile thumbnail (Meta serves those at s60x60).
 */
function parseMedia(card: RawCard): ScrapedAd["media"] {
  const media: ScrapedAd["media"] = [];

  for (const video of card.videos) {
    if (video.src) {
      media.push({
        type: "video",
        url: video.src,
        posterUrl: video.poster || undefined,
      });
    } else if (video.poster) {
      media.push({ type: "video", url: video.poster });
    }
  }

  for (const src of card.images) {
    if (/s\d{2}x\d{2}/.test(src) && !/s[3-9]\d{2}x/.test(src)) continue;
    if (media.some((m) => m.url === src)) continue;
    media.push({ type: "image", url: src });
  }

  return media.slice(0, 6);
}
