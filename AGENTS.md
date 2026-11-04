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
bun run --cwd frontend test:e2e # Playwright の E2E（スマホと PC）。スクリーンショットは frontend/e2e-results/
bun run --cwd frontend test golden -u # 一方向ドア面の golden の更新
cd frontend && bun scripts/factory/classify-change.ts --base origin/main # 変更の扱いの判定（作業ツリーを含む）
```


### Semantic lint

`tools/semantic-lint` と `.semantic-lint/` は運用を停止している。実行・保守・rule 追加をしない。

Repository Snapshot と Offline Dependencies を使う ChatGPT 実行環境では、対象Snapshotと同じworkflow runの `repository-environment-<target>-<sha>.json` から依存アーティファクトを取得する。全品質検証ではそのアーカイブを `scripts/chatgpt-verify.sh` に渡す。画面確認などで Vite を直接使う場合は、依存アーティファクトの `frontend/node_modules` を配置して利用する。画面確認などで Vite を直接使う場合は次を実行する。

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

### GitHub Actions

外部アクションは `.github/workflows/actions.lock` でコミットに固定する。`uses:` を追加・変更したら lockfile を更新する。

```sh
gh extension install github/gh-actions-lock # 初回のみ
gh actions-lock # 全ワークフローを走査して actions.lock を更新
```

## 検証

- 恒久的な検証には、既存のテスト基盤・静的解析・ビルドツールなどの汎用的な検証手段を用いること。
  - 特定の変更や不具合だけを対象とする検証を、再発防止だけを理由に追加しない。
- 人間の動作確認は、PRに Cloudflare が投稿するプレビューURLで行う。仕組みと設定は `frontend/README.md` の「PRプレビュー」を参照。

## 変更の扱い

PR は CI が差分から「自動」「体験確認」「承認」に分け、`扱い:*` ラベルと体験レビュー票をジョブサマリーに出す（ADR-0015）。判定の規則は `frontend/scripts/factory/change-treatment.ts` を正とする。

- エージェントは PR を merge しない。自動の扱いは CI が merge し（リポジトリ変数 `FACTORY_AUTO_MERGE` が `true` のとき）、体験確認と承認の扱いはプロダクトオーナーが merge する
- 合格基準（テストの削除、`frontend/golden/`、`frontend/e2e/` の既存テスト、CI、静的検査とテストの設定、要求・要件、ルール）を緩める変更は、実装と別の PR にし、緩める理由を PR 本文に書く
- `frontend/golden/` のテストが失敗したら、一方向ドア面（保存形式、問題ID・問題集の並び、評価規則、URL）に触れている
  - 意図した変更でなければ、コードを直す
  - 意図した変更なら golden を更新し、遊ぶ人に何が起きるか（遊び直せなくなる記録、変わる評価など）を PR 本文に書く
- 遊ぶ人の端末から情報を外へ送る処理（利用状況の計測、エラー収集など）を入れない。プライバシーポリシーなどを持たずに公開するため

## 文書

どの文書に何を書き、どう保つかは `.claude/rules/documents.md` を正とする。文書を書く・変える前に読む。

いつ読むか:

- 機能を足す・削る: `docs/プロダクト/要求/`・`要件/`
- 振る舞いを実装・変更・レビューする: `docs/プロダクト/要件/`・`仕様/`。パズルを作る・変えるときは該当パズルの仕様
- 画面・機能・演出を足す・変える、アプリとゲームの分担を判断する: `APP.md`
- ゲームを作る・変える: `GAME.md`
- 画面を足す・変える・レビューする: `docs/プロダクト/画面/` の該当する画面の文書
- UI を作る・変える・レビューする: `DESIGN.md`。正確な値は `frontend/styles/globals.css` の `@theme`
- 難易度を作る・変える: `docs/パズル/README.md` から難易度文書
- 決まりを変える・新しく決める前に、関係する過去の意思決定を確かめる: `docs/adr/`（`index.csv` から探す）

レビューや作業で決めたことは、同じ変更の中で、振る舞いはコードとテストに、守るべき決まりとその意図は該当する文書かルールに、将来の意思決定を揃えるべきプロジェクト全体の意思決定は ADR に反映する。

## Git運用

- PRはドラフトではなくオープンで作成する。
- PRはmerge commitでマージする。squash merge / rebase mergeは使わない。
- 作業中に`main`を取り込まない。
- 作業完了時、PRが`main`とコンフリクトしている場合のみ、最新`main`へrebaseする。コンフリクトしていなければrebaseしない。
