# Frontend

パズル pa-zzle のフロントエンド。

PoC の画面構成やディレクトリ構成は先取りせず、React アプリとして起動・検証できる最小構成にしている。

Biome、Tailwind CSS、shadcn/ui の設定と既存 UI 部品は、後続実装で利用できる開発資産として保持している。これらを採用していること自体から、PoC の画面構成やコンポーネント設計を固定しない。

## セットアップ

Bun はリポジトリルートの `.bun-version` に固定している。

```sh
bun install
```

## 開発

```sh
bun run dev
```

## PRプレビュー

Cloudflare Workers Builds の GitHub 連携を使い、非本番ブランチを Workers Static Assets のプレビューとして配信する。Worker の設定は `wrangler.jsonc` を正本とする。

Cloudflare 側では GitHub リポジトリを接続し、次のビルド設定を指定する。

- Production branch: `main`
- Root directory: `/frontend`
- Build command: `bun run build`
- Deploy command: `npx wrangler@4.132.0 deploy`
- Non-production branch deploy command: `npx wrangler@4.132.0 versions upload`
- Non-production branch builds: 有効

非本番ブランチのビルドでは、Cloudflare の GitHub 連携がPRへプレビューURLを投稿する。プレビューURLは `wrangler.jsonc` で明示的に有効化している。

プレビューURLはそのままでは公開されるため、運用開始前に Cloudflare Access でこの Worker の **Preview URLs** を保護し、許可した利用者だけが認証後に閲覧できる状態にする。本番公開の設定はこのプレビュー環境とは分けて扱う。

## 検証

```sh
bun run check
bun run typecheck
bun run test
bun run build
bun run semantic-lint:typecheck
```

### Semantic lint

通常の静的解析では表現しづらいプロジェクト固有の意味的規約を、Jevを使って検査する。rule定義はリポジトリルートの `.semantic-lint/rules/` を正本とし、CLIやprovider実装から分離する。

TypeSafe APIを利用するため、実行前にAPIキーを設定する。

```sh
export TYPESAFE_API_KEY="..."
```

frontend全体を検査する。

```sh
bun run semantic-lint
```

対象を絞る場合はパスを指定する。

```sh
bun run semantic-lint -- src/games/nanpure
bun run semantic-lint -- src/games/nanpure/example.test.ts
```

問題なし・対象外を含む全判定と確率を確認する場合は `--verbose` を指定する。

```sh
bun run semantic-lint -- --verbose
```

実行結果には総実行時間、ファイル単位の評価レイテンシのp50 / p95 / max、ファイル・判定スループットも表示する。並列数はリポジトリルートの `.semantic-lint/config.json` で変更できる。

初期ruleは `vitest.md` のうち意味判定が必要な規約だけを対象とし、すべて `warning` として運用する。精度と閾値を確認した後に必要なruleだけ `error` へ昇格する。
