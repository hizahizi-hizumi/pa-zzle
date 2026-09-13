---
name: commit
description: >
  This skill should be used when the user asks to "コミットして", "未コミット差分をコミットして",
  "変更をコミット", "差分をコミット", "適切な粒度でコミット", "コミットを分割して作成",
  "commit changes", "make commits", "split into commits", "コミット作成".
  Analyzes uncommitted diffs on the current branch and creates one or more commits with appropriate
  granularity. Operates on the current branch only; it does not create branches or push.
argument-hint: "preview=false, scope=all"
allowed-tools: Read, Glob, Bash(git *), TaskCreate, TaskUpdate, TaskGet, TaskList
---

# 現在ブランチへのコミット作成

現在ブランチの staged / unstaged / untracked 差分を分析し、変更を論理単位でコミットする。ブランチ作成と push は行わない。

## 入力

- `${input:preview}`: 既定 `false`。`true` ならコミット計画だけを返す。
- `${input:scope}`: 既定 `all`。自然言語、ファイルパス、glob で対象差分を限定できる。指定範囲外には触れない。

## 手順

### 1. 入力検証

- Git 管理下であることを `git rev-parse --git-dir` で確認する。
- `git branch --show-current` が空なら停止する。
- `main` / `master` / `staging` 上ではコミットしない。作業ブランチが必要なら `commit-pr` を使う。
- `git status --porcelain=v1 -uall` で対象差分があることを確認する。
- リモートに同名ブランチが存在する場合、公開済み履歴を書き換える `--amend` / interactive rebase / force push を行わない。

### 2. ルール読込

`references/commit.md` を読み、コミット境界とメッセージ規約を適用する。

### 3. 差分把握

```bash
git status --porcelain=v1 -uall
git diff -M --name-status
git diff -M --stat
git diff
git diff --staged
```

`scope` がある場合は差分の意味を読み、対象部分だけに絞る。自然言語 scope の解釈に強い曖昧さが残る場合は、実行前に対象として解釈した差分を明示する。

### 4. コミット計画

1コミットを1つの論理的変更として設計する。

- 機械的変更と意味変更を分ける。
- 純粋なリファクタと挙動変更を原則分ける。
- 依存更新 / CI / 開発環境変更と機能変更を原則分ける。
- 実装と対応するテスト・契約変更を分離すると中間状態が壊れる場合は同じコミットに置く。
- ディレクトリ境界ではなく、変更理由と独立してrevertできる単位で判断する。
- 可能な範囲で各コミットを、変更範囲に対応する `AGENTS.md` の検証コマンドが通る状態にする。

各コミットについて、対象ファイル / hunk、メッセージ、順序を確定する。

### 5. コミット実行

`preview=true` なら計画だけを返して終了する。そうでなければ計画順に:

1. 必要に応じて `git restore --staged .` で staged 状態を整理する。
2. 対象だけを `git add <path>` または `git add -p` で stage する。
3. `git diff --staged` でコミット内容を再確認する。
4. `git commit -m "<message>"` を実行する。
5. 次のコミットへ進む。

計画外の差分は stage しない。途中で差分が変化した場合は残りを止め、現状を報告する。

## 参照

- `references/commit.md` — コミット粒度・メッセージ・履歴品質の正
