---
name: commit-pr
description: >
  未コミット差分を分析してコミットと PR の境界を決め、必要なブランチを作り、commit スキルと pr スキルを起動して1つ以上のオープンな PR を作る。
  「コミットしてPRを作って」「未コミット差分をPRにして」「変更をPRにまとめて」「差分をコミット・PR化して」
  「作業内容をPRにして」「変更をGitHubに上げてPRを作成して」「commit and create PR」「open PRs for my changes」と頼まれたときに使う。
argument-hint: "baseBranch=main, preview=false"
allowed-tools: Read, Bash(*/.claude/skills/commit-pr/scripts/validate-input.sh*), Bash(git status *), Bash(git diff *), Bash(git switch --no-track -c *), Skill, TaskCreate, TaskUpdate, TaskGet, TaskList
---

# commit-pr

## 入力

- `${input:baseBranch}`: 既定 `main`
- `${input:preview}`: 既定 `false`。`true` のときは PR 計画だけを返す

## 手順

1. 入力を確かめる

   ```bash
   "$CLAUDE_PROJECT_DIR/.claude/skills/commit-pr/scripts/validate-input.sh" "<baseBranch>"
   ```

   - 失敗したら停止して、出力されたエラーを報告する
   - 成功すると `baseBranch`・`baseRef`・`currentBranch`・`isCreateBranch` が `key=value` の行で返る
2. `AGENTS.md` の「Git運用」と `references/pr-boundaries.md` を読む
3. 差分を把握する。差分が無ければ終える

   ```bash
   git status --porcelain=v1 -uall
   git diff -M --name-status
   git diff -M --stat
   git diff
   git diff --staged
   ```

4. `pr-boundaries.md` に沿って PR を計画し、各 PR について次を決める
   - 1文で説明できる目的
   - 含めるファイル / 必要なら hunk
   - 独立 PR かスタック PR か
   - 作る順序
   - タイトル候補
   - base
5. `pr-boundaries.md` の「数」の見直しに当たるときは、実行前に分割方針を示す
6. `preview=true` なら計画を返して終える
7. 1件目の PR のブランチを用意する
   - `isCreateBranch=true` のときは、PR の目的に合った作業ブランチを `baseRef` から作る。未コミット差分は作業ツリーごと持ち越す

     ```bash
     git switch --no-track -c "<type>/<short-description>-<timestamp>" "<baseRef>"
     ```

   - `isCreateBranch=false` のときは、現在ブランチをそのまま使い、新しいブランチを重ねて作らない
8. この PR に含める範囲を渡して `commit` スキルを起動し、終わったら `pr` スキルを起動する

   ```text
   Skill(commit, args="scope=<このPRの対象>, preview=false")
   Skill(pr, args="baseBranch=<PRのbase>, preview=false")
   ```

9. 2件目以降は、残った未コミット差分ごとに次を行う
   1. 前の PR に依存するなら前の PR のブランチから、独立するなら `baseRef` から、`git switch --no-track -c "<type>/<short-description>-<timestamp>" "<branch-base>"` でブランチを作る
   2. 8 と同じく `commit` スキル、`pr` スキルの順に起動する。`pr` の `baseBranch` は、独立 PR なら入力の `baseBranch`、スタック PR なら直前の PR のブランチにする
10. 作った PR の URL、各 PR の base / head、残った未コミット差分があればその存在を報告する

## 制約

- ブランチを切り替えるときに残りの差分が競合して持ち越せなければ停止し、stash・reset をしない
- 計画外の差分を捨てない
