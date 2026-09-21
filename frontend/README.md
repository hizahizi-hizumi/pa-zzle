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

通常の静的解析では表現しづらいプロジェクト固有の意味的規約を、bounded decision providerを使って検査する。設計判断は `docs/adr/ADR-0001-semantic-lint-architecture.md` を参照する。

人間向け規約の正本は `.claude/rules/*.md` 等に置き、semantic lintのrulesetはその実行可能な解釈として `.semantic-lint/rules/*.yaml` に定義する。同じ適用対象と規約sourceを共有するruleは1 rulesetへまとめる。

TypeSafe providerを使うコマンドではAPIキーが必要。

```sh
export TYPESAFE_API_KEY="..."
```

通常の検査は `check` を使う。active ruleだけを実行する。

```sh
bun run semantic-lint -- check
bun run semantic-lint -- check src/games/nanpure
```

校正中のdraft ruleも含める場合は `--include-draft` を指定する。

```sh
bun run semantic-lint -- check --include-draft
```

出力はcanonicalな `RunResult` から生成し、pretty / compact / JSONを選べる。

```sh
bun run semantic-lint -- check --format pretty
bun run semantic-lint -- check --format compact
bun run semantic-lint -- check --format json
```

Git等で作ったpath一覧を渡す場合は `--files-from` を使う。semantic lint本体はGitやPRへ依存しない。

```sh
bun run semantic-lint -- check --files-from changed-files.txt
```

rule一覧と設定診断:

```sh
bun run semantic-lint -- rules
bun run semantic-lint -- rules vitest
bun run semantic-lint -- doctor
```

ruleが意図どおり適用されない場合は `inspect` を使う。providerを呼ばずにcompiled rule、path match、ASTから抽出したsubject、EvaluationPlan、provider payloadまで確認できる。

```sh
bun run semantic-lint -- inspect vitest/arrange-outside-test src/example.test.ts --plan-only
```

`--plan-only` を外すと実際にproviderへ問い合わせ、raw responseと最終Diagnosticも確認する。Authorization headerやAPI keyはtraceへ出力しない。

golden corpusによるrule校正:

```sh
bun run semantic-lint -- eval
bun run semantic-lint -- eval vitest/arrange-outside-test --repeat 10
```

golden caseは `.semantic-lint/cases/<ruleset>/cases.yaml` とstableなfixtureで管理する。evalはcacheを使わず、Choice一致率、threshold一致率、違反確率のmin / mean / max、token usageを観測する。

rule lifecycleは `draft / active / disabled`。新規ruleはdraftで追加し、golden corpusと実コードで校正してからactiveへ変更する。severityの `warning / error` とは独立して管理する。

TypeScript / TSX / JavaScriptのVitest scopeはTypeScript ASTから決定論的に抽出する。modelへ行番号やsymbolを生成させず、ruleが指定した `file / vitest.test / vitest.beforeEach / vitest.describe` のsubjectを最初から評価する。file判定後にlocationを再判定する二段階方式は使わない。

semantic lintツール自身の決定論的検証:

```sh
bun run semantic-lint:typecheck
bun run semantic-lint:test
```

通常のverifyではschema/compiler、scope抽出、planner、engine、provider mapping、reporter等の決定論的テストだけを実行し、外部providerへの実リクエストは行わない。
