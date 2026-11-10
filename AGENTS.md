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

- 変更の種類から必要な品質検証を選び、実施した根拠と未確認事項をPRに残す。選び方と判定は `docs/開発/品質検証手順.md` に従う。
- 恒久的な検証には、既存のテスト基盤・静的解析・ビルドツールなどの汎用的な検証手段を用いること。
  - 特定の変更や不具合だけを対象とする検証を、再発防止だけを理由に追加しない。
- 画面変更の確認は、`docs/開発/画面レビュー手順.md` に従って、実際の描画・操作・途中状態・画面遷移・エラーを確認する。
- 人間の動作確認は、PRに Cloudflare が投稿するプレビューURLで行う。確認を頼むときは、そのURLを渡す。仕組みと設定は `frontend/README.md` の「PRプレビュー」を参照。

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

文書・コード・資料が食い違ったときは、上のものに従う。正しさを確かめる仕組みの強さに合わせるため（ADR-0013）。

1. 要求・要件、`AGENTS.md`・`CLAUDE.md`・`APP.md`・`GAME.md`・`DESIGN.md`、`.claude/rules/`
2. コードとテスト
3. 1 以外の正本の文書（仕様、難易度文書、各ディレクトリの README など）
4. 資料（`.claude/rules/documents.md` で資料とした文書）

- コードが 1 と食い違ったらコードを直す。1 の決まりそのものを変えるときは、同じ変更で 1 を直す
- 3 がコードと食い違ったら、3 をコードに合わせて直す
- ADR はこの順に含めない。今の文書・コードと食い違ったときは `docs/adr/README.md` に従う

レビューや作業で決めたことは、同じ変更の中で、振る舞いはコードとテストに、守るべき決まりは該当する文書かルールに、将来の意思決定を揃えるべきプロジェクト全体の意思決定は ADR に反映する。

文書・ルールを直すときは、継ぎはぎにしない。継ぎはぎを重ねると、大事な決まりとそうでない決まりが同じ大きさで並ぶため。

- 指摘された箇所に継ぎ足さず、文書全体を読み直し、一続きに読める形に書き直す。ADR は本文を書き換えないので除く。
- 書き終えたら、文脈を引き継がないサブエージェントに全文を読ませ、継ぎ目・重複・ほかの文書との食い違いを指摘させる。

## 進め方

プロダクトオーナー（PO）の思考と時間を奪わないように進める。

- 決まりと文書、PO のこれまでの発言から判断できることは自分で判断する。PO には、それで決められず、答えによって作業が変わることだけを聞く。
- PO に判断を求めるのは、原因と、比べられる選択肢を揃えてからにする。
- 失敗は原因を突き止めてから直す。タイムアウトを延ばすだけの対応はしない。
- 確認事項は、番号だけでなく内容を書く。
- 見た目は、ブラウザで表示したスクリーンショットで確かめてから見せる。
- ゲームの実装は、文脈を引き継がないサブエージェントに、作る側と遊ぶ側の両方の目線でレビューさせてから見せる。

## Git運用

- PRはドラフトではなくオープンで作成する。
- PRはmerge commitでマージする。squash merge / rebase mergeは使わない。
- PRの中でレビューや作業の指摘を直すときは、修正のコミットを重ねず、元のコミットに含める。push済みなら `--force-with-lease` でpushする。
- 作業中に`main`を取り込まない。
- 作業完了時、PRが`main`とコンフリクトしている場合のみ、最新`main`へrebaseする。コンフリクトしていなければrebaseしない。
