---
name: review-quality
description: >
  コードの正確性・境界条件・設計・テスト妥当性・安全性・性能・操作性を、一般的な工学的品質の観点から調査する。「実装品質をレビュー」「潜在バグを探して」「設計品質を調べて」「review code quality」「find bugs」「design review」または review からの品質検査依頼で使う。
allowed-tools: Read, Glob, Grep, Bash(git show *), Bash(git diff *), Bash(git ls-files *), Task
---

# review-quality

`/review-quality` で一般的な実装品質をレビューする。規約や文書に書かれていない問題も調べ、単なる好みを欠陥としない。

## 手順

1. `AGENTS.md` を読み、固定 ref、対象範囲、変更目的と実装の境界を把握する。PR なら差分外の呼び出し元・利用箇所・テスト・設定を追うが、指摘は原則変更によって発生・悪化した問題に限る。
2. 対象のリスクに応じて正確性、境界値、状態遷移、競合、例外、安全性、性能、設計・責務、テストの妥当性、操作性・アクセシビリティを調査する。関連のない観点は省略理由を残す。
3. 現象と原因を具体的な入力・実行経路・前後状態で説明する。既存のガード・テスト・呼び出し契約・仕様上の許容範囲によって候補が否定されないか、逆方向から確認する。
4. 可能な限り最小再現・テスト・静的検査で確かめる。画面が対象なら `docs/開発/画面レビュー手順.md` を読んで実ブラウザで操作・途中状態・エラーを確認する。環境依存の不具合を再現できない場合、コードからの疑義と実証済みの欠陥を分ける。
5. 追加の専門レビュアーが必要な場合は `.claude/agents/` の description と入力契約を確認する。入力を満たすときだけ起動し、既存の `puzzle-code-reviewer` や `puzzle-experience-reviewer` の内容をここに複製しない。起動できない場合は未実施と記録する。
6. `${CLAUDE_PROJECT_DIR}/.claude/skills/share/review-result.md` を読み、根拠・反証・検証状況を明示して報告する。外部状態を変更しない。

## 評価

このスキルの評価・改訂時は `evals/README.md` を読み、`evals/cases.json` の固定 ref・入力で実行する。`evals/ground-truth.md` は結果を確定するまで開かない。
