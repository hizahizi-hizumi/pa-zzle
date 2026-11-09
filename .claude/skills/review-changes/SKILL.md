---
name: review-changes
description: >
  今のブランチの変更を、ルールに沿っているかと、不具合・テストの不足・余計な複雑さの2つの観点でレビューし、確かめた指摘を重さ順に報告する。
  「コードレビューして」「変更をレビューして」「差分をレビューして」「このブランチをレビューして」
  「review my changes」「review this branch」「review the diff」と頼まれたときに使う。
argument-hint: "[変更の意図]"
allowed-tools: Bash(git fetch origin main), Bash(git merge-base origin/main HEAD), Bash(git rev-parse --short HEAD), Bash(git ls-files --others --exclude-standard), Bash(git add -N *), Bash(git diff --output=/tmp/review-changes/*), Bash(git diff --name-only --output=/tmp/review-changes/*), Bash(git log --format=%B *), Bash(mkdir -p /tmp/review-changes/*)
---

# review-changes

`/review-changes [変更の意図]`

## 手順

1. `git fetch origin main` の後に `git merge-base origin/main HEAD` で比較の基準を求める。fetch が失敗したら手元の `origin/main` で求め、そのことを報告に書く
2. `git ls-files --others --exclude-standard` で挙げた未追跡のファイルをすべて `git add -N <ファイル>` で差分に載せる
3. `git rev-parse --short HEAD` の値で作業ディレクトリ `/tmp/review-changes/<短い SHA>/` を作り、次を書く
   - `diff.patch`: `git diff --output=<作業ディレクトリ>/diff.patch <基準>`
   - `files.txt`: `git diff --name-only --output=<作業ディレクトリ>/files.txt <基準>`
4. `files.txt` が空なら、レビューする変更が無いことを伝えて終える
5. 変更の意図を決める。引数があれば引数、無ければ `git log --format=%B <基準>..HEAD` と会話から1〜3文にまとめる
6. 次の2つのエージェントを同時に起動する。会話の経緯は渡さない
   - `rule-compliance-reviewer`: `diff.patch` と `files.txt` の絶対パス
   - `code-quality-reviewer`: `diff.patch` と `files.txt` の絶対パスと、5 の変更の意図
7. 返った指摘をまとめる
   - 同じ箇所への同じ問題は1つにし、重い方の重さにする
   - Critical と Major と `[推測]` の指摘は、該当するコードを読んで確かめる。誤っていた指摘は落とし、理由を控える
8. 次をユーザーに伝える
   - 重さ順の指摘。各指摘に `ファイル:行`・問題・直し方・出所（ルールのパスと項目、または品質の観点）を書く
   - `rule-compliance-reviewer` が返した当てたルール
   - 落とした指摘とその理由
   - 2 で `git add -N` したファイル（インデックスに intent-to-add として残っている）
   - 2つのエージェントの「ほかの気づき」（重なりはまとめる）
9. 直すかは `CLAUDE.md` か呼び出した側の指示に従う。指示が無ければユーザーの指示を待つ
