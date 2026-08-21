"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Monitor } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";

type CheckResult = {
  status: "success" | "error" | "throttled";
  fetched: number;
  newCount: number;
  existingCount: number;
  message: string | null;
  warnings?: string[];
};

export function MonitorManager({
  monitors,
  demoMode,
}: {
  monitors: Monitor[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Checks are slow (a real browser runs), so track which row is busy.
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);

    // Mirror of the server-side rules, so obvious mistakes don't round-trip.
    if (!name.trim()) {
      setFormError("広告主名を入力してください。");
      return;
    }
    if (!url.trim()) {
      setFormError("広告ライブラリURLを入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, adLibraryUrl: url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "登録に失敗しました。");
        return;
      }
      setName("");
      setUrl("");
      refresh();
    } catch {
      setFormError("登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(monitor: Monitor) {
    if (togglingId) return;
    setTogglingId(monitor.id);
    try {
      await fetch(`/api/monitors/${monitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !monitor.enabled }),
      });
      refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(monitor: Monitor) {
    // Never rendered in demo mode; the API rejects it there regardless.
    if (demoMode) return;
    if (!confirm(`「${monitor.name}」と保存済みの広告を削除しますか？`)) return;
    await fetch(`/api/monitors/${monitor.id}`, { method: "DELETE" });
    refresh();
  }

  async function handleCheck(monitor: Monitor) {
    // One check at a time across the whole page: a second Chromium launch is
    // the most expensive thing a mis-click can cause. The server enforces the
    // same rule, this just keeps the UI honest about it.
    if (checkingId) return;

    setCheckingId(monitor.id);
    setResults((prev) => {
      const next = { ...prev };
      delete next[monitor.id];
      return next;
    });
    try {
      const res = await fetch(`/api/monitors/${monitor.id}/check`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      // 409 = already running, 429 = still in cooldown.
      if (res.status === 409 || res.status === 429) {
        setResults((prev) => ({
          ...prev,
          [monitor.id]: {
            status: "throttled",
            fetched: 0,
            newCount: 0,
            existingCount: 0,
            message:
              data.error ??
              "直前にチェック済みです。しばらく待ってから再実行してください。",
          },
        }));
        return;
      }

      setResults((prev) => ({
        ...prev,
        [monitor.id]: {
          status: data.status === "success" ? "success" : "error",
          fetched: data.fetched ?? 0,
          newCount: data.newCount ?? 0,
          existingCount: data.existingCount ?? 0,
          message: data.message ?? data.error ?? "取得に失敗しました。",
          warnings: data.warnings,
        },
      }));
      refresh();
    } catch {
      setResults((prev) => ({
        ...prev,
        [monitor.id]: {
          status: "error",
          fetched: 0,
          newCount: 0,
          existingCount: 0,
          message: "取得に失敗しました。しばらく待ってから再試行してください。",
        },
      }));
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">監視対象を追加</h2>
        <p className="mt-1 text-sm text-muted">
          Meta広告ライブラリで広告主を検索し、そのURLをそのまま貼り付けてください。
          広告主指定（view_all_page_id）とキーワード検索（q）の両方に対応します。
        </p>
        {demoMode && (
          <p className="mt-2 text-xs text-muted">
            デモ版では登録した監視対象を削除できません。同じURLの重複登録もできません。
          </p>
        )}
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <label className="block">
              <span className="text-sm font-medium">広告主名</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="例: 自社ブランド / 競合A"
                className="mt-1 w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">広告ライブラリURL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://www.facebook.com/ads/library/?...&country=JP&..."
                className="mt-1 w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>
          {formError && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "登録中…" : "登録"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">登録済み ({monitors.length})</h2>
        {monitors.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            まだ監視対象が登録されていません。
          </p>
        ) : (
          <ul className="space-y-3">
            {monitors.map((monitor) => {
              const result = results[monitor.id];
              const busy = checkingId === monitor.id;
              // A check elsewhere on the page also blocks this row's button.
              const otherBusy = checkingId !== null && !busy;
              return (
                <li
                  key={monitor.id}
                  className="rounded-lg border border-line bg-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{monitor.name}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            monitor.enabled
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {monitor.enabled ? "有効" : "無効"}
                        </span>
                        <span className="rounded bg-canvas px-2 py-0.5 text-xs text-muted">
                          {monitor.targetKind === "page" ? "広告主指定" : "キーワード"}
                          ・{monitor.country}
                        </span>
                      </div>
                      <a
                        href={monitor.adLibraryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block truncate text-xs text-accent hover:underline"
                      >
                        {monitor.adLibraryUrl}
                      </a>
                      <div className="mt-1.5 text-xs text-muted">
                        登録: {formatDateTime(monitor.createdAt)} ／ 最終確認:{" "}
                        {formatDateTime(monitor.lastCheckedAt)}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        onClick={() => handleCheck(monitor)}
                        disabled={busy || otherBusy}
                        aria-busy={busy}
                        className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {busy ? "取得中…" : "手動チェック"}
                      </button>
                      <button
                        onClick={() => handleToggle(monitor)}
                        disabled={togglingId !== null}
                        className="rounded border border-line px-3 py-1.5 text-sm hover:bg-canvas disabled:opacity-50"
                      >
                        {monitor.enabled ? "無効化" : "有効化"}
                      </button>
                      {/* Delete is not rendered at all in demo mode. */}
                      {!demoMode && (
                        <button
                          onClick={() => handleDelete(monitor)}
                          className="rounded border border-line px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </div>

                  {busy && (
                    <p className="mt-3 rounded bg-canvas px-3 py-2 text-sm text-muted">
                      ブラウザで広告ライブラリを開いて取得しています。20〜40秒ほどかかります。
                    </p>
                  )}

                  {result && (
                    <div
                      className={`mt-3 rounded px-3 py-2 text-sm ${
                        result.status === "success"
                          ? "bg-emerald-50 text-emerald-900"
                          : result.status === "throttled"
                            ? "bg-amber-50 text-amber-900"
                            : "bg-red-50 text-red-800"
                      }`}
                    >
                      {result.status === "success" ? (
                        <>
                          取得 {result.fetched} 件 ／ 新規{" "}
                          <strong>{result.newCount}</strong> 件 ／ 既存{" "}
                          {result.existingCount} 件
                        </>
                      ) : result.status === "throttled" ? (
                        <>{result.message}</>
                      ) : (
                        <>取得失敗: {result.message}</>
                      )}
                      {result.warnings?.map((w) => (
                        <div key={w} className="mt-1 text-xs">
                          {w}
                        </div>
                      ))}
                    </div>
                  )}

                  {!result && monitor.lastCheckStatus === "error" && (
                    <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
                      前回の取得は失敗しました: {monitor.lastCheckMessage}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
