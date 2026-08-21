/**
 * Standalone data-acquisition check.
 *
 * Run this before trusting the app: it hits the real Ad Library and reports,
 * field by field, what actually came back. No database, no UI.
 *
 *   npm run validate:fetch -- "<Ad Library URL>" [more URLs...]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { scrapeAdLibrary } from "../src/lib/adlib/scraper";
import type { ScrapedAd } from "../src/lib/adlib/types";

const FIELDS = [
  ["adArchiveId", "広告識別子 (Library ID)"],
  ["advertiserName", "広告主名"],
  ["bodyText", "広告本文"],
  ["startDate", "掲載開始日"],
  ["snapshotUrl", "スナップショットURL"],
  ["destinationUrl", "リンク先URL"],
] as const;

function coverage(ads: ScrapedAd[], key: (typeof FIELDS)[number][0]): string {
  const got = ads.filter((a) => a[key] != null && a[key] !== "").length;
  const pct = ads.length ? Math.round((got / ads.length) * 100) : 0;
  return `${got}/${ads.length} (${pct}%)`;
}

async function main() {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error("Usage: npm run validate:fetch -- \"<Ad Library URL>\" [...]");
    process.exit(1);
  }

  mkdirSync("validation-output", { recursive: true });
  let anyFailure = false;

  for (const url of urls) {
    console.log("\n" + "=".repeat(70));
    console.log("URL:", url);
    console.log("=".repeat(70));
    const startedAt = Date.now();

    try {
      const result = await scrapeAdLibrary(url, { maxAds: 25, maxScrolls: 2 });
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`取得: ${result.ads.length}件  (${elapsed}s)`);
      console.log(`Meta表示件数: ${result.reportedTotal ?? "不明"}`);
      result.warnings.forEach((w) => console.log("  [warn]", w));

      if (result.ads.length === 0) {
        console.log("  → 広告が0件でした。");
        anyFailure = true;
        continue;
      }

      console.log("\n--- フィールド取得率 ---");
      for (const [key, label] of FIELDS) {
        console.log(`  ${label.padEnd(26)} ${coverage(result.ads, key)}`);
      }
      const withImage = result.ads.filter((a) =>
        a.media.some((m) => m.type === "image"),
      ).length;
      const withVideo = result.ads.filter((a) =>
        a.media.some((m) => m.type === "video"),
      ).length;
      console.log(`  ${"画像あり".padEnd(26)} ${withImage}/${result.ads.length}`);
      console.log(`  ${"動画あり".padEnd(26)} ${withVideo}/${result.ads.length}`);

      const sample = result.ads[0];
      console.log("\n--- サンプル1件 ---");
      console.log("  Library ID   :", sample.adArchiveId);
      console.log("  広告主       :", sample.advertiserName);
      console.log("  掲載開始日   :", sample.startDate);
      console.log("  アクティブ   :", sample.isActive);
      console.log("  スナップショット:", sample.snapshotUrl);
      console.log("  リンク先     :", sample.destinationUrl);
      console.log("  メディア     :", sample.media.map((m) => m.type).join(", ") || "なし");
      console.log("  本文         :", (sample.bodyText || "").slice(0, 120).replace(/\n/g, " / "));

      const file = `validation-output/${Date.now()}.json`;
      writeFileSync(file, JSON.stringify({ url, ...result }, null, 2));
      console.log("\n  → 全件を保存:", file);
    } catch (error) {
      anyFailure = true;
      console.error("  取得失敗:", (error as Error).message);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(anyFailure ? "結果: 一部または全部が失敗しました" : "結果: 全URLで取得成功");
  process.exit(anyFailure ? 1 : 0);
}

main();
