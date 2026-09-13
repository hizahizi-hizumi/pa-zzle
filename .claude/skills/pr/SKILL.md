---
name: pr
description: >
  This skill should be used when the user asks to "PRを作って", "プルリクエストを作成して",
  "PRにして", "現在ブランチでPR作成", "create PR", "open PR".
  Creates a single open pull request from the current branch against a specified base branch.
  Uses committed changes only; uncommitted diffs are not included.
argument-hint: "baseBranch=main, preview=false"
allowed-tools: Read, Glob, Bash(git *), Bash(gh *), Bash(find *), TaskCreate, TaskUpdate, TaskGet, TaskList
---

# 現在ブランチからのオープンPR作成

現在ブランチのコミット済み差分を、指定 base（既定 `main`）に対する1つのオープンPRとして作成する。ブランチは新規作成しない。

## 入力

- `${input:baseBranch}`: 既定 `main`
- `${input:preview}`: 既定 `false`。`true` ならpush・PR作成を行わず計画のみ返す。

## 手順

### 1. 入力検証

- Git管理下であること。
- detached HEADでないこと。
- 現在ブランチとbaseBranchが異なること。
- baseBranchがローカルまたは `origin/<baseBranch>` に存在すること。
- `git log <baseRef>..HEAD --oneline` にコミット差分があること。
- `git status --porcelain` に未コミット差分がある場合、それらはPRに含まれないことを明示する。含める必要があるなら `commit-pr` を使う。

### 2. ルールとテンプレート

- `references/pr.md` を読む。
- `find . -type f -iname "*pull_request*template*"` でリポジトリ内テンプレートを探し、存在すれば優先する。
- タイトルのラベル・scopeは `.claude/skills/commit/references/commit.md` に従う。

### 3. 差分把握

```bash
git log "<baseRef>..HEAD" --oneline
git diff -M --name-status "<baseRef>...HEAD"
git diff -M --stat "<baseRef>...HEAD"
git diff "<baseRef>...HEAD"
```

変更目的、利用者影響、実装・テスト・文書・運用への影響を把握する。

### 4. PR内容設計

タイトルは「何が変わるか」が1行で分かるものにする。

本文には最低限以下を含める。

- What: 変更内容
- Why: 背景・理由
- Validation: 実施した確認。未実施の確認は未実施と書き、実行したと捏造しない。
- Impact / Risk: 利用者影響、互換性、運用影響など、該当するものだけ

検証コマンドは変更範囲に応じて `AGENTS.md` を参照する。

ADRに関係する重要判断が含まれる場合は、既存ADRへの参照または新規ADR要否を本文に記載してよい。ただしADR作成をこのSkillが勝手に行わない。

### 5. push

`preview=true` ならここで終了する。

upstream未設定なら:

```bash
git push --set-upstream origin "<currentBranch>"
```

設定済みなら `git push`。force pushはしない。

### 6. PR作成

```bash
gh pr create --base "<baseBranch>" --title "<title>" --body-file - <<'PR_BODY'
<PR本文>
PR_BODY
```

ドラフトにはしない。作成後にURLを取得する。

### 7. 作業完了時の競合確認

`baseBranch=main` の場合だけ、PR作成後にGitHub上の競合状態を確認する。

- コンフリクトしていなければ `main` を取り込まない。
- コンフリクトしている場合だけ最新 `origin/main` を取得し、作業ブランチへ merge commit で取り込んで競合を解消し、pushする。
- rebase、squash、force pushで追従しない。

作業途中では `main` を取り込まない。

## エラー処理

Git / push / gh が失敗したら、その時点で停止して事実だけを報告する。push済みでPR作成だけ失敗した場合、pushを取り消さない。

## 参照

- `references/pr.md` — PR粒度・レビュー容易性・構成ルール
- `.claude/skills/commit/references/commit.md` — タイトル用ラベル・scope
- `AGENTS.md` — Git運用・検証コマンド
