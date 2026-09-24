# pa-zzle

複数種類のパズルを遊び、問題生成・難易度・プレイ成績を扱うウェブアプリ。

## 実行コマンド

### リポジトリ全体

```sh
./scripts/verify.sh # 通常開発環境での全品質検証
./scripts/chatgpt-verify.sh <offline-dependencies.tar.zst> # ChatGPT実行環境での全品質検証
```

### Frontend

```sh
bun run --cwd frontend dev # PC環境の開発サーバー起動
bun run --cwd frontend check # Biome のチェック
bun run --cwd frontend typecheck # TypeScript の型検査
bun run --cwd frontend test # Vitest の1回実行
bun run --cwd frontend build # プロダクションビルド
```


### Semantic lint

```sh
bun run --cwd tools/semantic-lint check # 意味lint。TYPESAFE_API_KEYが必要
bun run --cwd tools/semantic-lint check -- --plan-only # providerを呼ばずrequest数と推定tokenを確認
bun run --cwd tools/semantic-lint eval # semantic lint ruleの校正。TYPESAFE_API_KEYが必要
bun run --cwd tools/semantic-lint inspect -- <rule-id> <file> --plan-only # providerを呼ばず評価計画を確認
bun run --cwd tools/semantic-lint rules # rule一覧
bun run --cwd tools/semantic-lint doctor # rule / scope / source / provider設定を診断
bun run --cwd tools/semantic-lint typecheck # semantic lintツールの型検査
bun run --cwd tools/semantic-lint test # semantic lintツールの決定論的テスト
```

Repository Snapshot と Offline Dependencies を使う ChatGPT 実行環境では、対象Snapshotと同じworkflow runの `repository-environment-<target>-<sha>.json` から依存アーティファクトを取得する。全品質検証ではそのアーカイブを `scripts/chatgpt-verify.sh` に渡す。画面確認などで Vite を直接使う場合は、依存アーティファクトの `frontend/node_modules` を配置して利用する。ChatGPT環境ではsemantic lintを実行しない。画面確認などで Vite を直接使う場合は次を実行する。

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
- 難易度の意味、提供、判定、開発工程を扱うときは `docs/パズル/README.md` から対応する難易度文書を参照する。
- UI・デザインの実装やレビューでは、視覚・情報階層・操作フィードバック・動きの正本として `DESIGN.md` を参照する。
- 正確なデザイントークン値は `frontend/styles/globals.css` の Tailwind CSS `@theme` を参照する。

## 文書

- `docs/プロダクト/`: 文書体系の責務、依存方向、識別子、参照規則と、現在のプロダクト定義の正本。利用者要求、システム要件、ユーザーストーリー、仕様、画面、受入条件を実装・設計・レビュー時に参照する。
- `docs/パズル/`: 難易度の横断的な原則・提供・判定・開発工程の正本と、`導入調査/` にパズル候補の成立性・導入判断・難易度検証などの調査・検証資料を置く。導入調査は現在仕様の正本として扱わない。
- `docs/立ち上げ/`: アプリ立ち上げ期に固有のPoC・仮説・正本化の経緯。長期的な正本として保守しない。
- `docs/adr/`: 意思決定の背景・比較・理由。ADRだけを現在仕様の正本として扱わない。
- `docs/棚上げ/`: 要求・要件候補やパズル候補と、その検討状況を整理する。現在仕様の正本でも作業バックログでもない。
- `docs/メモ/`: 開発上の参考資料。現在仕様の正本として扱わない。

## Git運用

- PRはドラフトではなくオープンで作成する。
- PRはmerge commitでマージする。squash merge / rebase mergeは使わない。
- 作業中に`main`を取り込まない。
- 作業完了時、PRが`main`とコンフリクトしている場合のみ、最新`main`へrebaseする。コンフリクトしていなければrebaseしない。
