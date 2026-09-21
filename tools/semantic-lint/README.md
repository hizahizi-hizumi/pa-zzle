# Semantic lint

プロジェクト固有の意味的規約をbounded decision providerで検査する独立ツール。

設計判断は `docs/adr/ADR-0001-semantic-lint-architecture.md`、rule定義はリポジトリルートの `.semantic-lint/` を参照する。

## Setup

```sh
bun install --cwd tools/semantic-lint --frozen-lockfile
```

TypeSafe providerを使うコマンドでは `TYPESAFE_API_KEY` が必要。

## Commands

```sh
bun run --cwd tools/semantic-lint check
bun run --cwd tools/semantic-lint check -- --include-draft
bun run --cwd tools/semantic-lint eval
bun run --cwd tools/semantic-lint eval -- vitest/arrange-outside-test --repeat 10
bun run --cwd tools/semantic-lint inspect -- vitest/arrange-outside-test frontend/src/records/storage.test.ts --plan-only
bun run --cwd tools/semantic-lint rules
bun run --cwd tools/semantic-lint doctor
bun run --cwd tools/semantic-lint typecheck
bun run --cwd tools/semantic-lint test
```

CLIのpath引数はrepository root基準で解決する。semantic lint packageはfrontend packageへ依存せず、AST parserを含むruntime/dev dependencyを `tools/semantic-lint/package.json` と `bun.lock` で所有する。

通常のrepository verifyでは外部providerへ接続せず、typecheck、deterministic test、doctor、`inspect --plan-only` のみを実行する。
