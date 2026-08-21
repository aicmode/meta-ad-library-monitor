import Link from "next/link";
import { listAds } from "@/lib/db/ads";
import { listMonitors } from "@/lib/db/monitors";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AdMedia } from "@/lib/adlib/types";

export const dynamic = "force-dynamic";

/**
 * Creatives are hotlinked from Meta's CDN. Image URLs (scontent.*) render
 * fine, but the video URLs (video.*) are short-lived and reject hotlinked
 * playback, so videos are shown as their poster frame with a badge — the
 * "元広告を開く" link is the reliable way to actually watch one.
 */
function MediaPreview({ media }: { media: AdMedia[] }) {
  const primary = media[0];
  if (!primary) {
    return (
      <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded border border-line bg-canvas text-xs text-muted">
        メディアなし
      </div>
    );
  }

  const isVideo = primary.type === "video";
  const src = isVideo ? primary.posterUrl : primary.url;

  if (!src) {
    return (
      <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded border border-line bg-canvas text-center text-xs text-muted">
        動画
        <br />
        （プレビュー不可）
      </div>
    );
  }

  return (
    <div className="relative h-40 w-40 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed CDN URLs, not optimizable */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-40 w-40 rounded border border-line object-cover"
      />
      {isVideo && (
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          ▶ 動画
        </span>
      )}
    </div>
  );
}

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; monitor?: string }>;
}) {
  const params = await searchParams;
  const onlyNew = params.new === "1";
  const monitorId = params.monitor;

  const monitors = listMonitors();
  const ads = listAds({ onlyNew, monitorId, limit: 200 });

  const buildHref = (next: { new?: boolean; monitor?: string }) => {
    const sp = new URLSearchParams();
    if (next.new) sp.set("new", "1");
    if (next.monitor) sp.set("monitor", next.monitor);
    const qs = sp.toString();
    return qs ? `/ads?${qs}` : "/ads";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">広告</h1>
        <p className="mt-1 text-sm text-muted">
          取得済みの広告一覧です。初回検出された広告に NEW が付き、次回のチェックで既存扱いになります。
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={buildHref({ monitor: monitorId })}
          className={`rounded border px-3 py-1.5 ${
            onlyNew ? "border-line bg-surface text-muted" : "border-accent bg-accent text-white"
          }`}
        >
          すべて
        </Link>
        <Link
          href={buildHref({ new: true, monitor: monitorId })}
          className={`rounded border px-3 py-1.5 ${
            onlyNew ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted"
          }`}
        >
          NEWのみ
        </Link>
        <span className="mx-1 w-px bg-line" />
        <Link
          href={buildHref({ new: onlyNew })}
          className={`rounded border px-3 py-1.5 ${
            !monitorId ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted"
          }`}
        >
          全広告主
        </Link>
        {monitors.map((m) => (
          <Link
            key={m.id}
            href={buildHref({ new: onlyNew, monitor: m.id })}
            className={`rounded border px-3 py-1.5 ${
              monitorId === m.id
                ? "border-accent bg-accent text-white"
                : "border-line bg-surface text-muted"
            }`}
          >
            {m.name}
          </Link>
        ))}
      </div>

      {ads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          該当する広告がありません。
          <Link href="/monitors" className="ml-1 text-accent hover:underline">
            監視対象で手動チェックを実行
          </Link>
          してください。
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">{ads.length} 件</p>
          <ul className="space-y-3">
            {ads.map((ad) => (
              <li
                key={ad.id}
                className={`rounded-lg border bg-surface p-4 ${
                  ad.isNew ? "border-amber-300" : "border-line"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <MediaPreview media={ad.media} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {ad.isNew && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-new">
                          NEW
                        </span>
                      )}
                      <span className="font-medium">
                        {ad.advertiserName || ad.monitorName}
                      </span>
                      <span className="rounded bg-canvas px-2 py-0.5 text-xs text-muted">
                        {ad.monitorName}
                      </span>
                      {!ad.isActive && (
                        <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                          停止中
                        </span>
                      )}
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {ad.bodyText || "（本文を取得できませんでした）"}
                    </p>

                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                      <div>
                        <dt className="inline">掲載開始: </dt>
                        <dd className="inline">{formatDate(ad.startDate)}</dd>
                      </div>
                      <div>
                        <dt className="inline">初回検出: </dt>
                        <dd className="inline">{formatDateTime(ad.firstSeenAt)}</dd>
                      </div>
                      <div>
                        <dt className="inline">最終確認: </dt>
                        <dd className="inline">{formatDateTime(ad.lastSeenAt)}</dd>
                      </div>
                      <div>
                        <dt className="inline">Library ID: </dt>
                        <dd className="inline font-mono">
                          {ad.adArchiveId ?? `${ad.dedupeKey}（fingerprint）`}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">メディア: </dt>
                        <dd className="inline">
                          {ad.media.length > 0
                            ? `${ad.media.length}件 (${[...new Set(ad.media.map((m) => m.type))].join(", ")})`
                            : "なし"}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {ad.snapshotUrl && (
                        <a
                          href={ad.snapshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          元広告を開く →
                        </a>
                      )}
                      {ad.destinationUrl && (
                        <a
                          href={ad.destinationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-muted hover:underline"
                        >
                          リンク先を開く →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
