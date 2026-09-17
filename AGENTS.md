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

Repository Snapshot と Offline Dependencies を使う ChatGPT 実行環境では、対象Snapshotと同じworkflow runの `repository-environment-<target>-<sha>.json` から依存アーティファクトを取得し、`frontend/node_modules` に配置して Vite を使う。

```sh
frontend/node_modules/.bin/vite --config frontend/vite.chatgpt.config.ts --host 127.0.0.1 --port 3000
```

ChatGPT環境で画面確認する場合は、`docs/メモ/ChatGPT画面確認.md` の手順に従い、`scripts/chatgpt_playwright.py` を使って描画・操作・スクリーンショット・ブラウザエラーまで確認する。

### Backend

```sh
uv run --directory backend pytest # pytest のテスト実行
uv run --directory backend mypy . # mypy の型チェック
uv run --directory backend ruff check . # Ruff の静的解析
```

## 検証

- 恒久的な検証には、既存のテスト基盤・静的解析・ビルドツールなどの汎用的な検証手段を用いること。
  - 特定の変更や不具合だけを対象とする検証を、再発防止だけを理由に追加しない。

## 体験・デザイン

- アプリ全体の体験やゲーム選択・結果・記録などの判断では `APP.md` を参照する。
- 個々のゲームで守るゲーム体験や、アプリ共通とゲーム固有の境界を判断するときは `GAME.md` を参照する。
- UI・デザインの実装やレビューでは、視覚・情報階層・操作フィードバック・動きの正本として `DESIGN.md` を参照する。
- 正確なデザイントークン値は `frontend/styles/globals.css` の Tailwind CSS `@theme` を参照する。

## 文書

- `docs/立ち上げ/`: 立ち上げ期のPoC・調査・仮説資料。PoCの経緯や根拠を扱うときに参照し、長期的な正本として保守しない。正本へ昇格済みの内容は `APP.md` / `GAME.md` / `DESIGN.md` を優先する。
- `docs/adr/`: 意思決定の背景・比較・理由を残す。ADRだけを現在仕様の正本として扱わない。
- `docs/メモ/`: 開発上の参考資料。現在仕様の正本として扱わない。

## Git運用

- PRはドラフトではなくオープンで作成する。
- PRはmerge commitでマージする。squash merge / rebase mergeは使わない。
- 作業中に`main`を取り込まない。
- 作業完了時、PRが`main`とコンフリクトしている場合のみ、最新`main`へrebaseする。コンフリクトしていなければrebaseしない。
