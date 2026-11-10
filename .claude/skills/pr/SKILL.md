---
name: pr
description: >
  現在ブランチのコミット済みの変更から、指定した base ブランチに向けたオープンな PR を1つ作る。未コミット差分は含めず、ブランチも作らない。
  「PRを作って」「プルリクエストを作成して」「PRにして」「現在ブランチでPR作成」「create PR」「open PR」「open a pull request」と頼まれたときに使う。
argument-hint: "baseBranch=main, preview=false"
allowed-tools: Read, Glob, Bash(git rev-parse *), Bash(git branch --show-current), Bash(git show-ref *), Bash(git status *), Bash(git log *), Bash(git diff *), Bash(git fetch *), Bash(gh pr create *), Bash(gh pr view *), TaskCreate, TaskUpdate, TaskGet, TaskList
---

# pr

## 入力

- `${input:baseBranch}`: 既定 `main`
- `${input:preview}`: 既定 `false`。`true` のときは push と PR 作成をせず、計画だけを返す

## 手順

1. 入力を確かめ、満たさなければ停止する
   - `git rev-parse --git-dir` で Git 管理下であること
   - `git branch --show-current` が空でない（detached HEAD でない）こと
   - 現在ブランチが `baseBranch` と異なること
   - `git show-ref` で `baseBranch` がローカルか `origin/<baseBranch>` にあること。あった方を `baseRef` とする
   - `git log <baseRef>..HEAD --oneline` にコミットがあること
2. `git status --porcelain` に未コミット差分があるときは、それが PR に含まれないことと、含めるには `commit-pr` スキルを使えることを伝え、コミット済みの変更だけで続ける
3. 次を読む
   - `AGENTS.md` の「Git運用」と「検証」
   - `references/pr.md`
   - タイトルのラベルと scope を決めるために `${CLAUDE_PROJECT_DIR}/.claude/skills/share/commit.md` の「メッセージ」
   - `{.github/,docs/,}{pull_request_template,PULL_REQUEST_TEMPLATE}.md` と `{.github/,docs/,}{pull_request_template,PULL_REQUEST_TEMPLATE}/*.md` を Glob して見つかった PR テンプレート。あれば `pr.md` の本文の形より優先する
4. 差分を把握し、変更の目的、利用者への影響、実装・テスト・文書・運用への影響をつかむ

   ```bash
   git log "<baseRef>..HEAD" --oneline
   git diff -M --name-status "<baseRef>...HEAD"
   git diff -M --stat "<baseRef>...HEAD"
   git diff "<baseRef>...HEAD"
   ```

5. `pr.md` の「PR 本文」に沿ってタイトルと本文を書く。ADR に関わる重要な判断が含まれるときは、既存 ADR への参照か新規 ADR の要否を本文に書いてよい。ADR はこのスキルでは作らない
6. `preview=true` ならタイトル・本文・push 先を計画として返して終える
7. push する。`git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` が失敗したら upstream が未設定なので `git push --set-upstream origin "<currentBranch>"`、成功したら `git push` を使う。履歴を書き換えたときの push は `AGENTS.md` の「Git運用」に従う
8. PR を作り、URL を得る

   ```bash
   gh pr create --base "<baseBranch>" --title "<title>" --body-file - <<'PR_BODY'
   <PR本文>
   PR_BODY
   ```

9. `baseBranch=main` のときだけ、`gh pr view --json mergeable` で `main` との競合を確かめ（`UNKNOWN` なら取り直す）、`AGENTS.md` の「Git運用」の作業完了時の決まりに従う。rebase するときは `git fetch origin main` で最新の `origin/main` を取る
10. PR の URL と base / head を報告する

## 制約

- git・push・gh が失敗したらその時点で停止し、事実だけを報告する
- push 済みで PR 作成だけが失敗したときは push を取り消さない
