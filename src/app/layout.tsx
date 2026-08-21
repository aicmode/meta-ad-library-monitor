import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { isDemoMode } from "@/lib/config/demo";

export const metadata: Metadata = {
  title: "Meta Ad Library Monitor",
  description: "任意の広告主の新規広告を継続的に検出するモニタリングツール",
};

const NAV = [
  { href: "/", label: "ダッシュボード" },
  { href: "/monitors", label: "監視対象" },
  { href: "/ads", label: "広告" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demo = isDemoMode();

  return (
    <html lang="ja">
      <body className="min-h-screen">
        {demo && (
          <div className="border-b border-line bg-canvas">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-2">
              <span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">
                Demo / Prototype
              </span>
              <span className="text-xs text-muted">
                試作版のため、取得結果や動作がMeta側の変更により不安定になる場合があります。
              </span>
            </div>
          </div>
        )}
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Meta Ad Library Monitor
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-3 py-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
