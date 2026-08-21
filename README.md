# Meta Ad Library Monitor

任意の広告主・競合企業を複数登録し、Meta広告ライブラリ上の**新しく掲載された広告を継続的に検出する**汎用モニタリングツールです。

特定の企業・業種に依存しません。看護・美容・不動産・人材・EC・スクールなど、広告ライブラリで検索できる広告主であれば業種を問わず登録できます。企業名はコードに一切ハードコードされていません。

---

## 何ができるか

1. 監視したい広告主を、Meta広告ライブラリのURLで登録する
2. 手動チェックを実行すると、その広告主の広告一覧を取得して保存する
3. 2回目以降の取得で前回データと差分を比較する
4. 前回存在しなかった広告を **NEW** として表示する
5. 一度NEWと判定した広告は、次回の取得で既存扱いになる（毎回NEWにならない）

---

## 現在のMVP機能

- 監視対象の登録 / 一覧 / 有効・無効切替 / 削除
- 広告ライブラリURLの検証（広告主指定・キーワード検索の両形式に対応）
- 手動での広告取得（Playwrightによる実ブラウザ取得）
- 広告の保存とNEW / 既存の差分判定
- ダッシュボード（監視対象数・NEW件数・保存済み件数・最終チェック日時）
- 広告一覧（NEWフィルタ、広告主フィルタ、メディアプレビュー、元広告リンク）
- 取得方式の単体検証スクリプト
- 外部共有用のDemo Mode（削除禁止・重複登録防止・連打防止・cooldown）

---

## 技術構成

| 領域 | 採用 |
|---|---|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイル | Tailwind CSS v4 |
| データ取得 | Playwright (Chromium) |
| DB | SQLite (better-sqlite3) |

DBアクセスは `src/lib/db/` のリポジトリ層に閉じ込めてあり、ルートハンドラやUIはSQLを直接触りません。将来Supabase / PostgreSQLへ移行する際は、このリポジトリ層の実装のみを差し替えれば済む構造です。

---

## 取得方式

**Meta公式のAd Library APIは使用していません（使用できません）。**

公式API (`ads_archive`) は仕様上、**EU圏に配信されなかった広告については政治・社会問題・選挙広告しか返しません**。日本向けの一般商用広告は完全に対象外です。これはMeta公式ドキュメントに明記されており、実測でも確認しました。

そのため本ツールは、**ログイン不要で公開されている広告ライブラリのWebページを、Playwrightの実ブラウザで取得**しています。

検証の詳細（実測データ、取得できた項目・できなかった項目、判断根拠）は **[docs/DATA_ACQUISITION.md](docs/DATA_ACQUISITION.md)** に記録しています。導入前に必ず一読してください。

### 取得できる情報

ライブラリID / 広告主名 / 広告本文 / 掲載開始日 / スナップショットURL / リンク先URL / 画像 / 動画の有無とポスター画像 / アクティブ状態

### 取得できない情報

- **インプレッション数・費用・ターゲティング情報** — 一般商用広告では広告ライブラリ自体が開示していません
- **動画の再生** — 動画URLは短時間で失効する署名付きURLでホットリンク再生が拒否されるため、ポスター画像のみ表示し、再生は「元広告を開く」で広告ライブラリへ誘導します

---

## Meta側の仕様上の制約（重要）

- 公式APIではないため、**Metaの仕様変更で動作しなくなる可能性があります**
- 広告カードに安定したCSSクラス名がないため、ラベル文字列を起点にDOMを解析しています
- 高頻度アクセスや大量の並行実行はアクセス制限を招く可能性があります
- 1回の取得で保存する件数は既定で最大60件です（キーワード検索では全件を網羅しません）
- Metaの利用規約は自動収集を制限しています。**業務利用の際は自組織の法務・コンプライアンス方針に照らして判断してください**

本ツールは、ログイン・CAPTCHA回避・Bot対策の突破・アクセス制限の回避を一切行いません。制限ページが返された場合は、回避を試みずエラーとして報告します。

---

## セットアップ

```bash
npm install
npx playwright install chromium
```

Node.js 20以上が必要です（動作確認は v24.15.0）。

---

## 起動方法

```bash
npm run dev
# http://localhost:3000
```

SQLiteのDBファイルは `data/monitor.db` に自動生成されます（gitignore済み）。保存先は環境変数 `DATABASE_PATH` で変更できます。

環境変数は `.env.example` を `.env.local` にコピーして設定してください。

### 使い方

1. [Meta広告ライブラリ](https://www.facebook.com/ads/library/) で監視したい広告主を検索する
2. そのときのURLをブラウザからコピーする
3. `/monitors` で広告主名とURLを登録する
4. 「手動チェック」を押す（実ブラウザが起動するため20〜40秒かかります）
5. `/ads` で取得結果を確認する。初回は全件がNEWになります
6. しばらく後に再度「手動チェック」を実行すると、新しく掲載された広告だけがNEWになります

### 取得方式だけを検証する

UIやDBを介さず、実際に取得できるかどうかだけを確認できます。

```bash
npm run validate:fetch -- "https://www.facebook.com/ads/library/?...&country=JP&..."
```

項目ごとの取得率が表示され、全件のJSONが `validation-output/` に保存されます。Metaの仕様変更を検知するため、定期的な実行を推奨します。


---

## Demo Mode（外部共有用）

社外の方に試作版を触ってもらうための安全モードです。環境変数で切り替えます。

```bash
DEMO_MODE=true npm start
```

`DEMO_MODE=true` のときだけ、以下の制御が有効になります。

| 制御 | 内容 |
|---|---|
| 削除不可 | 監視対象の削除ボタンを表示せず、`DELETE /api/monitors/:id` も **HTTP 403** で拒否します |
| 一括削除の禁止 | `npm run db:reset` は `DEMO_MODE=true` では実行を拒否します（Web UIからは元々実行できません） |
| 登録数の上限 | 監視対象は最大30件まで（それ以上は403） |
| 重複登録防止 | 同一の広告ライブラリURLは二重登録できません（HTTP 409） |
| 手動チェック連打防止 | 実行中はボタンを無効化。サーバー側でも監視対象ごとにロックし、同時実行を **HTTP 409** で拒否します |
| cooldown | 同じ監視対象は前回チェックから **60秒間** 再実行できません（**HTTP 429**、`Retry-After` ヘッダ付き） |
| 安全なエラー表示 | 内部エラーの詳細・ファイルパス・SQL・stack traceは画面へ出しません。詳細はサーバーのターミナルにのみ記録します |
| Demo表示 | 画面上部に「Demo / Prototype」バッジと注意書きを表示します |

`DEMO_MODE` が未設定または `false` のときは、従来どおりの管理機能（削除を含む）がそのまま使えます。

### 相手ができること / できないこと

**できること**：ダッシュボード閲覧 / 監視対象閲覧 / 広告一覧閲覧・フィルタ / 元広告を開く / 監視対象の追加 / 有効・無効の切替 / 手動チェック

**できないこと**：監視対象の削除 / 広告データの削除 / DB初期化 / システム設定の変更

認証機能は実装していません。共有するURLは、渡した相手の範囲に留めてください。

### 入力チェック

監視対象の追加時、以下を **サーバー側で** 検証します（DEMO_MODEに関係なく常時有効）。

- 広告主名が必須（空白のみは不可）／80文字以内／制御文字不可
- 広告ライブラリURLが必須／1000文字以内／制御文字不可
- `http` / `https` 以外のscheme（`javascript:` `data:` `file:` 等）を拒否
- ホストは `facebook.com` 系のみ、パスは `/ads/library` 配下のみ
- `view_all_page_id`（数値）または `q`（キーワード）のどちらかが必要
- 正規化後のURLで重複を検知（DB側にも一意インデックス）

---

## データの保護とバックアップ

- DBファイルの場所：既定は `data/monitor.db`（WALモードのため `-wal` / `-shm` も同じ場所に生成されます）
- `DATABASE_PATH` で変更可能。デプロイ先では **永続ボリューム上のパス** を指定してください
- `data/` は `.gitignore` 済みです。**DBファイルをGitへコミットしないでください**
- バックアップ方針：デモ公開前と、まとまったデータが溜まった時点で、`data/` ディレクトリごとコピーして退避してください

```bash
# 停止した状態でコピーするのが最も確実です
cp -r data "backup-$(date +%Y%m%d-%H%M)"
```

- 復旧：退避したファイルを `data/` へ戻すだけです
- DBファイルを削除するとスキーマは自動で再作成されます（データは失われます）
- ローカルでのリセット：`npm run db:reset`（`DEMO_MODE=true` では拒否されます）

自動バックアップは実装していません。試作・検証用途のため、失われて困るデータは置かない前提で運用してください。

---

## Health Check

```
GET /api/health  →  {"status":"ok","demoMode":true,"time":"..."}
```

プロセスの生存とSQLiteへの到達性のみを確認します。**Playwrightの起動やMeta広告ライブラリへのアクセスは一切行いません**。ホスティング側のヘルスチェックに設定しても取得処理は発生しません。

---

## デプロイ（Railway等）

デモURLを共有する場合の手順です。

### Dockerイメージで動かします（Chromium同梱）

本番では **リポジトリ直下の `Dockerfile`** を使います。ベースイメージは Playwright 公式の

```
mcr.microsoft.com/playwright:v1.62.1-noble
```

で、`package.json` / `package-lock.json` の `playwright` と**同一バージョンに固定**しています。このイメージには Chromium 本体と必要な共有ライブラリが `/ms-playwright` に同梱されているため、再デプロイのたびにブラウザを取得し直す必要がなく、

```
browserType.launch: Executable doesn't exist at ...
```

が発生しません（ビルド中に `npx playwright install chromium` も実行し、将来のバージョン差分に備えています）。

> **playwright を更新するときは、`package.json` とこの Dockerfile のイメージタグを必ず同じコミットで揃えてください。** バージョン不一致は上記エラーの再発原因そのものです。

`chromium.launch()` は Playwright に実行ファイルを解決させています。**`executablePath` はハードコードしません**（環境固有の絶対パスを埋め込むと環境差で壊れるため）。

### better-sqlite3 のネイティブビルド依存

Dockerfile では `npm ci` の**前に** `python3` / `make` / `g++` を導入しています。

```
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
```

`better-sqlite3` 13.x はビルド済みバイナリを同梱していますが、パッケージ内に `binding.gyp` を持ち install スクリプトを持たないため、**npm が `npm ci` の中で自動的に `node-gyp rebuild` を実行します**。Playwright公式イメージにはコンパイラが入っていないため、これが以下のビルド失敗になります。

```
npm error gyp ERR! stack Error: not found: make
```

必要最小限は node-gyp が要求する `python3`（ジェネレータ）・`make`・`g++` の3つで、`g++` が gcc と libc6-dev を連れてきます。`build-essential` は本プロジェクトで使わないパッケージまで含むため採用していません。`rm -rf /var/lib/apt/lists/*` でaptキャッシュは破棄します。

この依存は**Dockerfileに書くことが必須**です。RailwayのBuild Commandや、コンソールから手打ちした `apt install` / `npm rebuild` は再デプロイ・再起動で失われ、再現性がありません。**Railway側のBuild Command / Start Commandは空欄のまま**にしてください。

### Railway側の設定

1. リポジトリを接続し、**必ず `DEMO_MODE=true`** を環境変数に設定する
2. Builder は **Dockerfile**（直下の `Dockerfile` と `railway.json` により自動選択されます）
   - **Build Command / Start Command はどちらも不要**です。ダッシュボードに旧設定（`npx playwright install ...` を含むBuild Commandなど）が残っている場合は空にしてください
3. 永続ボリュームを `/data` にマウントし、`DATABASE_PATH=/data/monitor.db` を設定する
   （ボリュームがないと再デプロイのたびにデータが消えます）
4. Health Check Path に `/api/health` を設定する（`railway.json` にも記述済み）
5. デプロイ後、`https://<公開URL>/api/health` が `{"status":"ok","demoMode":true}` を返すことを確認する
6. `/monitors` を開き、「Demo / Prototype」バッジが表示され、削除ボタンが無いことを確認してからURLを共有する

`PORT` はRailwayが注入した値をそのまま使い、`0.0.0.0` で待ち受けます。

手動チェックは実ブラウザを起動するため、メモリに余裕のあるプランを選んでください（Chromiumの実行に概ね1GB以上を推奨）。実行には20〜40秒かかるため、リクエストタイムアウトが短いホスティングでは失敗します。

### Chromiumが起動できるかの確認

デプロイ先やDockerコンテナ内で、ブラウザが本当に起動するかだけを確認できます。

```bash
npm run smoke:playwright            # 起動確認のみ（外部アクセスなし）
npm run smoke:playwright -- --page  # 公開中の広告ライブラリを1ページだけ開く
```

### ローカルでのDocker確認

```bash
docker build -t meta-ad-library-monitor .

docker run --rm -p 3000:3000 \
  -e DEMO_MODE=true \
  -e DATABASE_PATH=/data/monitor.db \
  -v meta-ad-monitor-data:/data \
  meta-ad-library-monitor
```

---

## 環境変数

| 変数 | 既定 | 用途 |
|---|---|---|
| `DEMO_MODE` | 未設定（=false） | `true` で外部共有用の安全モード |
| `DATABASE_PATH` | `data/monitor.db` | SQLiteファイルの保存先 |
| `PORT` | `3000` | 待ち受けポート |

---

## NEW判定の仕組み

広告の同一性は次の優先順で判定します。

1. **ライブラリID** — Metaが払い出す識別子。再取得しても不変なため、これを主キーとして使います
2. **フィンガープリント** — ライブラリIDが取得できなかった場合のみ、広告主名・本文・掲載開始日・リンク先のSHA-256ハッシュで代用します

監視対象ごとに `(monitor_id, dedupe_key)` でユニーク制約を張っています。

- 初めて見た広告 → INSERT、`is_new = 1`（NEW表示）
- 既に保存済みの広告 → UPDATE、`is_new = 0`、`last_seen_at` 更新、`times_seen` 加算

**次回の取得で再確認された時点でNEWが外れる**ため、同じ広告が繰り返しNEWになることはありません。`first_seen_at` / `last_seen_at` / `times_seen` を保持しているので、後から検出履歴を辿れます。

---

## 現在未対応の機能

MVPの範囲外として、意図的に実装していません。

- LINE / Slack / Email 通知
- クラウドでの定期自動実行（現在は手動チェックのみ）
- AIによる広告分析・クリエイティブ比較
- 認証・複数ユーザー対応
- 高度なダッシュボード（推移グラフ等）

---

## 今後のロードマップ

1. **定期実行** — 全有効監視対象を順番にチェックするバッチ処理。`runCheck()` は監視対象単位で独立しているため、cron / GitHub Actions から呼び出せます
2. **通知** — NEW検出時にLINE / Slack / Emailへ送信。`runCheck()` が返す `newCount` と `newAdIds` が既にフックポイントになっています
3. **Supabase移行** — `src/lib/db/` のリポジトリ層を差し替え、複数端末で共有可能に
4. **クリエイティブの永続化** — Meta CDNのURLは失効するため、画像を自前ストレージに保存
5. **広告の停止検知** — `is_active` と `last_seen_at` を使い、掲載終了した広告も検出する
6. **AI分析** — 訴求軸の分類、競合とのクリエイティブ傾向比較

---

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                    ダッシュボード
│   ├── monitors/page.tsx           監視対象
│   ├── ads/page.tsx                広告一覧
│   ├── api/monitors/...            登録・切替・削除・手動チェック
│   └── api/health/route.ts         死活監視（Playwrightを起動しない）
├── components/
│   └── MonitorManager.tsx          監視対象の操作UI
└── lib/
    ├── adlib/                      広告ライブラリの取得層
    │   ├── url.ts                  URL検証・正規化
    │   ├── scraper.ts              Playwrightによる取得と抽出
    │   └── types.ts
    ├── config/demo.ts              Demo Modeの判定と各種上限値
    ├── errors.ts                   内部エラーと利用者向けメッセージの境界
    ├── db/                         永続化層（差し替え可能）
    │   ├── client.ts               SQLite接続とスキーマ
    │   ├── monitors.ts
    │   └── ads.ts                  保存とNEW判定
    └── monitor/
        ├── runCheck.ts             取得→差分→記録のオーケストレーション
        └── checkGuard.ts           同時実行ロックとcooldown
scripts/validate-fetch.ts           取得方式の単体検証
scripts/playwright-smoke.mjs        Chromiumが起動できるかの確認
scripts/db-reset.mjs                ローカル専用のDB削除（DEMO_MODEでは拒否）
docs/DATA_ACQUISITION.md            技術検証の記録
Dockerfile                          本番イメージ（Playwright公式 + Chromium同梱）
.dockerignore
railway.json                        Railwayのビルダー指定とヘルスチェック
```
