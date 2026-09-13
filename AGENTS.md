# pa-zzle

複数種類のパズルを遊び、問題生成・難易度・プレイ成績を扱うウェブアプリ。

## 実行コマンド

### リポジトリ全体

```sh
./scripts/verify.sh # 現時点の全品質検証
```

### Frontend

```sh
bun run --cwd frontend dev # PC環境の開発サーバー起動
bun run --cwd frontend check # Biome のチェック
bun run --cwd frontend typecheck # TypeScript の型検査
bun run --cwd frontend test # Vitest の1回実行
bun run --cwd frontend build # プロダクションビルド
```

Repository Snapshot と Offline Dependencies を使う ChatGPT 実行環境では、依存アーティファクトを `frontend/node_modules` に配置して Vite を使う。

```sh
frontend/node_modules/.bin/vite --config frontend/vite.chatgpt.config.mjs --host 127.0.0.1 --port 3000
```

ChatGPT環境で画面確認する場合は、Vite開発サーバーを起動し、既存のPlaywright / Chromiumで描画・操作・スクリーンショットまで確認する。

### Backend

```sh
uv run --directory backend pytest # pytest のテスト実行
uv run --directory backend mypy . # mypy の型チェック
uv run --directory backend ruff check . # Ruff の静的解析
```

## 文書

- `docs/立ち上げ/`: 現在のPoC方針・アプリ概要・調査資料。PoCの要件や方向性を扱うときに参照する。
- `docs/adr/`: 意思決定の背景・比較・理由を残す。ADRだけを現在仕様の正本として扱わない。
- `docs/メモ/`: 開発上の参考資料。現在仕様の正本として扱わない。

## Git運用

- PRはドラフトではなくオープンで作成する。
- PRはmerge commitでマージする。squash merge / rebase mergeは使わない。
- 作業中に`main`を取り込まない。
- 作業完了時、PRが`main`とコンフリクトしている場合のみ、最新`main`をmerge commitで取り込む。コンフリクトしていなければ取り込まない。
