---
name: commit-pr
description: >
  This skill should be used when the user asks to "コミットしてPRを作って", "未コミット差分をPRにして",
  "変更をPRにまとめて", "差分をコミット・PR化して", "commit and create PR",
  "作業内容をPRにして", "変更をGitHubに上げてPRを作成して".
  Analyzes uncommitted diffs, designs commit and PR boundaries, creates branches as needed,
  then orchestrates the commit and pr skills to produce one or more draft pull requests.
argument-hint: "baseBranch=main, preview=false"
allowed-tools: Read, Glob, Bash(git *), Bash(find *), Bash(*validate-input.sh*), Skill, TaskCreate, TaskUpdate, TaskGet, TaskList
---

# 未コミット差分のコミットとPR作成

未コミット差分全体を分析し、必要なら複数PRへ分割する。各PR内のコミット境界は `commit`、PR作成は `pr` に委譲する。

## 入力

- `${input:baseBranch}`: 既定 `main`
- `${input:preview}`: 既定 `false`。`true` ならPR計画だけを返す。

## 手順

### 1. 入力検証

プロジェクト内スクリプトを使う。

```bash
"$CLAUDE_PROJECT_DIR/.claude/skills/commit-pr/scripts/validate-input.sh" "<baseBranch>"
```

成功時は次を返す。

```text
baseBranch=main
baseRef=main
currentBranch=main
isCreateBranch=true
```

- `isCreateBranch=true`: 現在ブランチへ直接コミットせず、最初のPR用ブランチを `baseRef` から作る。
- `isCreateBranch=false`: 現在の作業ブランチを最初のPRに使う。

### 2. PR境界ルール

`references/pr-boundaries.md` を読む。

### 3. 未コミット差分把握

```bash
git status --porcelain=v1 -uall
git diff -M --name-status
git diff -M --stat
git diff
git diff --staged
```

差分が無ければ終了する。

### 4. PR計画

各PRについて以下を確定する。

- 1文で説明できる目的
- 含めるファイル / 必要ならhunk
- 独立PRかスタックPRか
- 作成順序
- タイトル候補
- base

AmuQueryでは、problem / fixture / oracle / 採点基準 / manifest や、LUの設計・教材・評価などをフォルダ単位で機械的に分割しない。成立するVertical Sliceや契約単位を優先する。

1PRで十分なら分けない。5PRを超えそうなら、実行前に分割方針を明示する。

`preview=true` ならここで計画を返して終了する。

### 5. 1件目のPR

#### 現在がbaseブランチの場合

`isCreateBranch=true` なら、PR目的に応じた作業ブランチを作る。

```bash
git switch -c "<type>/<short-description>-<timestamp>" "<baseRef>"
```

未コミット差分は作業ツリーごと持ち越す。stashは使わない。

#### 既存作業ブランチの場合

`isCreateBranch=false` なら現在ブランチをそのまま1件目に使う。新しいブランチを重ねて作らない。

#### commit / PR

このPRに含めるscopeを指定して `commit` を起動する。

```text
Skill(commit, args="scope=<このPRの対象>, preview=false")
```

完了後、`pr` を起動する。

```text
Skill(pr, args="baseBranch=<baseBranch>, preview=false")
```

### 6. 2件目以降

残った未コミット差分について、前PRへの依存有無でbranch baseを決める。

- 前PRに依存する: 前PRブランチから新ブランチを作る。
- 独立する: `baseRef` から新ブランチを作る。

```bash
git switch -c "<type>/<short-description>-<timestamp>" "<branch-base>"
```

その後 `commit` → `pr` を同様に実行する。独立PRの `pr baseBranch` は入力base、スタックPRは直前のPRブランチを指定する。

ブランチ切替時に残差分が競合して持ち越せない場合は停止し、無理にstash・resetしない。

### 7. 完了報告

- 作成したPR URL
- 各PRのbase / head
- 残った未コミット差分があればその存在

を返す。

## 制約

- force pushしない。
- `main` / `master` / `staging` へ直接コミットしない。
- 計画外の差分を勝手に捨てない。
- PR数を増やすこと自体を目的にしない。

## 参照

- `references/pr-boundaries.md` — 複数PR境界
- `.claude/skills/commit/` — コミット作成
- `.claude/skills/pr/` — PR作成
