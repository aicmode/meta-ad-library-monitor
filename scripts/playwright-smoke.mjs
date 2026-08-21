/**
 * Chromium availability check for a deployed environment.
 *
 * Answers one question: can Playwright actually launch a browser here?
 * That is the failure this exists for — a host where the playwright package is
 * installed but its Chromium build is not, which surfaces at runtime as
 * "browserType.launch: Executable doesn't exist at ...".
 *
 *   node scripts/playwright-smoke.mjs            # launch only
 *   node scripts/playwright-smoke.mjs --page     # also open one public Ad Library page
 *
 * Launch-only mode touches no external site. --page opens the same logged-out
 * public page the app itself reads; it does not log in and does not work around
 * any interstitial.
 */
import { chromium } from "playwright";

const AD_LIBRARY_URL =
  "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=JP&q=%E8%BB%A2%E8%81%B7&search_type=keyword_unordered";

const openPage = process.argv.includes("--page");
let browser;

try {
  console.log("executablePath:", chromium.executablePath());
  browser = await chromium.launch({ headless: true });
  console.log("✓ chromium.launch OK  /  browser version:", browser.version());

  if (openPage) {
    const context = await browser.newContext({
      locale: "en-US",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
      viewport: { width: 1500, height: 1100 },
    });
    const page = await context.newPage();
    const response = await page.goto(AD_LIBRARY_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    console.log("HTTP status:", response?.status() ?? "(none)");
    await page.waitForTimeout(9000);

    const bodyText = await page.locator("body").innerText();
    const cards = (bodyText.match(/Library ID/g) || []).length;
    console.log(`body length: ${bodyText.length} / "Library ID" hits: ${cards}`);
    if (cards === 0) {
      // Not a Chromium problem — Meta served something other than results.
      console.log(
        "! 広告カードを検出できませんでした（Meta側の表示・制限の可能性）。ブラウザ起動自体は成功しています。",
      );
    }
  }

  console.log("✓ smoke test finished");
} catch (error) {
  console.error("✗ smoke test failed:", error);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
