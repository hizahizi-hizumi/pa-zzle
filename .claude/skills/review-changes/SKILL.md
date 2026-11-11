---
name: review-changes
description: >
  今のブランチの変更を、ルールに沿っているか、コードの品質（不具合・テストの不足・余計な複雑さ）、画面に関わる変更なら遊ぶ側の目線の3つの観点でレビューし、確かめた指摘を重さ順に報告する。
  「コードレビューして」「変更をレビューして」「差分をレビューして」「このブランチをレビューして」
  「review my changes」「review this branch」「review the diff」と頼まれたときに使う。
  PR 番号やほかのブランチを指定してレビューを頼まれたときは使わない。
argument-hint: "[変更の意図]"
allowed-tools: Bash(git fetch origin main), Bash(git merge-base origin/main HEAD), Bash(git ls-files --others --exclude-standard), Bash(git add -N *), Bash(git diff --output=/tmp/review-changes/run-*/diff.patch *), Bash(git diff --name-only --output=/tmp/review-changes/run-*/files.txt *), Bash(git log --format=%B *), Bash(mkdir -p /tmp/review-changes), Bash(mkdir -p /tmp/review-changes/run-*/playtest), Bash(mktemp -d /tmp/review-changes/run-XXXXXX), Bash(bun install --cwd frontend), Bash(bun run --cwd frontend dev *), TaskStop
---

# review-changes

`/review-changes [変更の意図]`

## 手順

1. `git fetch origin main` の後に `git merge-base origin/main HEAD` で比較の基準を求める。fetch が失敗したら手元の `origin/main` で求め、そのことを報告に書く
2. `git ls-files --others --exclude-standard` で挙げた未追跡のファイルをすべて `git add -N <ファイル>` で差分に載せる
3. `mkdir -p /tmp/review-changes` の後に `mktemp -d /tmp/review-changes/run-XXXXXX` で実行ごとの作業ディレクトリを作り、次を書く
   - `diff.patch`: `git diff --output=<作業ディレクトリ>/diff.patch <基準>`
   - `files.txt`: `git diff --name-only --output=<作業ディレクトリ>/files.txt <基準>`
4. `files.txt` が空なら、レビューする変更が無いことを伝えて終える
5. 変更の意図を決める。引数があれば引数、無ければ `git log --format=%B <基準>..HEAD` と会話から1〜3文にまとめる
6. `files.txt` に、次を除く `frontend/src/`・`frontend/public/`・`frontend/styles/` のファイルがあれば、画面に関わる変更として 7 を行う。無ければ 7 を飛ばす
   - テスト（`*.test.*`）と `frontend/src/testing/`
   - 型宣言（`*.d.ts`）
   - 問題集（`problem-pool*.json`）と問題生成（`problem/generation/`）
7. 試遊の準備をする
   - 差分から、遊ぶ人から見て変わったことを、画面の見え方・操作・流れの言葉で1〜3文にまとめる。コードの名前は書かない。画面の見え方・操作・流れが変わらず書けないときは、7 の残りと試遊を飛ばす
   - `frontend/src/pages/` のファイルの置き場所から、変わった所へ行く入口パスを決める
   - 端末を決める。`iphone` は必ず入れ、PC 幅の配置が変わる変更なら `pc` も入れる
   - `frontend/node_modules` が無ければ `bun install --cwd frontend` を実行する
   - 開発サーバーを `bun run --cwd frontend dev -- --port <ポート> --strictPort` で `run_in_background` で起動し、出力に出た URL を控える。ポートが使われていて起動に失敗したら、別のポートで起動し直す
   - 出力先 `<作業ディレクトリ>/playtest/` を作る
   - 端末ごとに、開発サーバーのポートと重ならない driver のポートを決める。8 で `change-playtester` に渡し、`change-playtester` が `${CLAUDE_PROJECT_DIR}/.claude/skills/share/playtest-driver.mjs` の起動に使う
8. 次のエージェントを同時に起動する。会話の経緯は渡さない
   - `rule-compliance-reviewer`: `diff.patch` と `files.txt` の絶対パス
   - `code-quality-reviewer`（`files.txt` に `.md` 以外のファイルがあるときだけ）: `diff.patch` と `files.txt` の絶対パスと、5 の変更の意図
   - `change-playtester`（7 を行ったときだけ）: 開発サーバーの URL、入口パス、遊ぶ人から見て変わったこと、端末、端末ごとに開発サーバーと重ならない driver のポート、出力先の絶対パス
9. 8 のエージェントがすべて返った後に、7 で起動した開発サーバーを TaskStop で止める
10. 返った指摘をまとめる
    - 同じ箇所への同じ問題は1つにし、重い方の重さにする
    - Critical と Major と `[推測]` の指摘は確かめる。コードの指摘は該当するコードを読み、`change-playtester` の指摘は添えられた画像を Read で見る。誤っていた指摘は落とし、理由を控える
11. 次をユーザーに伝える
    - 重さ順の指摘。各指摘に、場所（`ファイル:行` か画像のパス）・問題・直し方・出所（ルールのパスと項目、品質の観点、または試遊）を書く
    - `rule-compliance-reviewer` が返した当てたルール。`code-quality-reviewer` を起動しなかったときはそのこと
    - `change-playtester` が返した通した流れ・人間に確かめてほしい点・確かめられなかったこと。試遊を飛ばしたときや、driver が起動できず試遊できなかったときは、そのことと理由
    - 落とした指摘とその理由
    - 2 で `git add -N` したファイル（インデックスに intent-to-add として残っている）
    - エージェントの「ほかの気づき」（重なりはまとめる）
12. 直すかは `CLAUDE.md` か呼び出した側の指示に従う。指示が無ければユーザーの指示を待つ
