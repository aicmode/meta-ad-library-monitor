/** A single ad creative/media item attached to an ad. */
export type AdMedia = {
  type: "image" | "video";
  url: string;
  /** Video poster frame, when the media is a video. */
  posterUrl?: string;
};

/**
 * One ad as scraped from the Meta Ad Library.
 * Field availability is documented in docs/DATA_ACQUISITION.md — anything
 * optional here is genuinely not guaranteed to be present on every card.
 */
export type ScrapedAd = {
  /** Meta "Library ID". Stable across checks. Absent only if the card fails to expose it. */
  adArchiveId: string | null;
  /** Advertiser / Page name as displayed on the card. */
  advertiserName: string | null;
  /** Numeric Facebook Page id, when it can be resolved from the page payload. */
  pageId: string | null;
  /** Primary ad body copy. */
  bodyText: string | null;
  /** ISO date (YYYY-MM-DD) parsed from "Started running on ...". */
  startDate: string | null;
  /** Whether the card is labelled Active. */
  isActive: boolean;
  /** Permalink to this ad in the Ad Library. */
  snapshotUrl: string | null;
  /** Advertiser's landing page (destination) URL, unwrapped from l.facebook.com. */
  destinationUrl: string | null;
  media: AdMedia[];
  /** Raw card text, kept for fingerprinting and debugging. */
  rawText: string;
};

export type ScrapeResult = {
  ads: ScrapedAd[];
  /** Total result count reported by Meta ("~23 results"), when shown. */
  reportedTotal: number | null;
  /** Non-fatal problems worth surfacing to the user. */
  warnings: string[];
};

export type ScrapeOptions = {
  /** Stop after this many ads. */
  maxAds?: number;
  /** Max scroll rounds used to load more results. */
  maxScrolls?: number;
  headless?: boolean;
  /** Milliseconds to wait after navigation for client-side rendering. */
  settleMs?: number;
};
