---
name: pr
description: >
  This skill should be used when the user asks to "PRを作って", "プルリクエストを作成して",
  "PRにして", "現在ブランチでPR作成", "create PR", "open PR", "draft PR".
  Creates a single draft pull request from the current branch against a specified base branch.
  Uses committed changes only; uncommitted diffs are not included.
argument-hint: "baseBranch=main, preview=false"
allowed-tools: Read, Glob, Bash(git *), Bash(gh *), Bash(find *), TaskCreate, TaskUpdate, TaskGet, TaskList
---

# 現在ブランチからのドラフトPR作成

現在ブランチのコミット済み差分を、指定 base（既定 `main`）に対する1つのドラフトPRとして作成する。ブランチは新規作成しない。

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

変更目的、学習者影響、runtime / grading / 学習設計 / docsへの影響を把握する。

### 4. PR内容設計

タイトルは「何が変わるか」が1行で分かるものにする。

本文には最低限以下を含める。

- What: 変更内容
- Why: 背景・理由
- Validation: 実施した確認。`uv run --frozen python -m dev.tools.validate` 未実施なら未実施と書き、実行したと捏造しない。
- Impact / Risk: learner-facing、採点、runtime、公開境界、後方互換など、該当するものだけ

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
gh pr create --draft --base "<baseBranch>" --title "<title>" --body-file - <<'EOF'
<PR本文>
EOF
```

作成後にURLを返す。

## エラー処理

Git / push / gh が失敗したら、その時点で停止して事実だけを報告する。push済みでPR作成だけ失敗した場合、pushを取り消さない。

## 参照

- `references/pr.md` — PR粒度・レビュー容易性・構成ルール
- `.claude/skills/commit/references/commit.md` — タイトル用ラベル・scope
