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
bun run --cwd tools/semantic-lint bench -- [rule-id...] --repeat 3 # goldenでruleを採点しthresholdを校正。TYPESAFE_API_KEYが必要
bun run --cwd tools/semantic-lint bench -- --plan-only # providerを呼ばずbenchのrequest数と推定tokenを確認
bun run --cwd tools/semantic-lint inspect -- <rule-id> <file> --plan-only # providerを呼ばず評価計画を確認
bun run --cwd tools/semantic-lint rules # rule一覧
bun run --cwd tools/semantic-lint doctor # ruleset / unitカタログ / golden / cache / provider設定を診断
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

- アプリ全体の体験や、アプリ共通とゲーム固有の境界を判断するときは `APP.md` を参照する。
- 個々のゲームで守るゲーム体験は `GAME.md` を参照する。
- 難易度の意味、提供、判定、開発工程を扱うときは `docs/パズル/README.md` から対応する難易度文書を参照する。
- UI・デザインの実装やレビューでは、視覚・情報階層・操作フィードバック・動きの正本として `DESIGN.md` を参照する。
- 正確なデザイントークン値は `frontend/styles/globals.css` の Tailwind CSS `@theme` を参照する。

## 文書

文書の置き場所と書き方は `docs/README.md` を正とする（ADR-0003）。振る舞いの詳細はコードとテストを正とし、文書へ写さない。

- `docs/プロダクト/`: 要求・要件・仕様。実装・設計・レビュー時に参照する。
- `docs/adr/`: 決定の理由。過去の判断を確かめるときに参照する。
- `docs/パズル/`: 難易度を作るときの手引きと、パズル候補の導入調査（調査は正本ではない）。
- `docs/棚上げ/`・`docs/立ち上げ/`・`docs/メモ/`: 資料。正本として扱わない。
- レビューや作業で決めたことは、同じ変更の中で、振る舞いはコードとテストに、守るべき決まりは該当する仕様・設計原則・ルールに、理由が要るものは ADR に反映する。

## Git運用

- PRはドラフトではなくオープンで作成する。
- PRはmerge commitでマージする。squash merge / rebase mergeは使わない。
- 作業中に`main`を取り込まない。
- 作業完了時、PRが`main`とコンフリクトしている場合のみ、最新`main`へrebaseする。コンフリクトしていなければrebaseしない。
