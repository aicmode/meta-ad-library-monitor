import Link from "next/link";
import { getDashboardStats, listAds } from "@/lib/db/ads";
import { listMonitors } from "@/lib/db/monitors";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const stats = getDashboardStats();
  const monitors = listMonitors();
  const recentNew = listAds({ onlyNew: true, limit: 5 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">ダッシュボード</h1>
        <p className="mt-1 text-sm text-muted">
          登録した広告主の広告ライブラリを取得し、前回との差分から新規広告を検出します。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="監視対象"
          value={stats.monitorCount}
          hint={`有効 ${stats.enabledMonitorCount} 件`}
        />
        <Stat label="新規広告 (NEW)" value={stats.newAds} hint="未確認の新着" />
        <Stat label="保存済み広告" value={stats.totalAds} hint="累計" />
        <Stat
          label="最終チェック"
          value={stats.lastCheckedAt ? "実行済み" : "—"}
          hint={formatDateTime(stats.lastCheckedAt)}
        />
      </div>

      {stats.monitorCount === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-sm text-muted">
            まだ監視対象がありません。広告主とMeta広告ライブラリURLを登録してください。
          </p>
          <Link
            href="/monitors"
            className="mt-4 inline-block rounded bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            監視対象を追加
          </Link>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">最近の新規広告</h2>
            <Link href="/ads?new=1" className="text-sm text-accent hover:underline">
              すべて見る
            </Link>
          </div>
          {recentNew.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface p-5 text-sm text-muted">
              現在NEW判定の広告はありません。
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {recentNew.map((ad) => (
                <li key={ad.id} className="flex gap-3 p-4">
                  <span className="mt-0.5 h-fit shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-new">
                    NEW
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{ad.monitorName}</div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                      {ad.bodyText || "（本文なし）"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {monitors.some((m) => m.lastCheckStatus === "error") && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-800">取得エラー</h2>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {monitors
              .filter((m) => m.lastCheckStatus === "error")
              .map((m) => (
                <li key={m.id}>
                  {m.name}: {m.lastCheckMessage}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
