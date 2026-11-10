---
name: commit
description: >
  現在ブランチの未コミット差分を分析し、論理的な単位で1つ以上のコミットを作る。ブランチの作成と push はしない。
  「コミットして」「未コミット差分をコミットして」「変更をコミット」「差分をコミット」「適切な粒度でコミット」
  「コミットを分割して作成」「コミット作成」「commit changes」「make commits」「split into commits」と頼まれたときに使う。
argument-hint: "preview=false, scope=all"
allowed-tools: Read, Bash(git rev-parse *), Bash(git branch --show-current), Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git restore --staged *), Bash(git add *), Bash(git commit *), TaskCreate, TaskUpdate, TaskGet, TaskList
---

# commit

## 入力

- `${input:preview}`: 既定 `false`。`true` のときはコミット計画だけを返す
- `${input:scope}`: 既定 `all`。自然言語・ファイルパス・glob で対象の差分を限る。範囲外の差分には触れない

## 手順

1. 入力を確かめ、満たさなければ停止する
   - `git rev-parse --git-dir` で Git 管理下であること
   - `git branch --show-current` が空でないこと
   - 現在ブランチが `main` / `master` / `staging` でないこと。停止するときは、作業ブランチを作ってコミットするには `commit-pr` スキルを使えることを伝える
   - `git status --porcelain=v1 -uall` に対象の差分があること
2. `${CLAUDE_PROJECT_DIR}/.claude/skills/share/commit.md` を読む
3. 次のコマンドで差分を読む

   ```bash
   git status --porcelain=v1 -uall
   git diff -M --name-status
   git diff -M --stat
   git diff
   git diff --staged
   ```

4. `scope` があるときは差分の意味を読み、対象部分だけに絞る。自然言語の `scope` の解釈に強い曖昧さが残るときは、対象として解釈した差分を実行前に示す
5. `${CLAUDE_PROJECT_DIR}/.claude/skills/share/commit.md` の「境界」と「履歴」に沿ってコミットの対象ファイル / hunk と順序を決め、「メッセージ」に沿って各コミットのメッセージを決める
6. `preview=true` なら計画を返して終える
7. 計画の順に、コミットごとに次を行う。途中で差分が変わったときは残りを止め、現状を報告する
   1. 必要なら `git restore --staged .` で staged 状態を整える
   2. 計画の対象だけを `git add <path>` か `git add -p` で stage する
   3. `git diff --staged` でコミット内容を確かめる
   4. `git commit -m "<message>"` を実行する
8. 作ったコミットを `git log --oneline` で示して終える
