---
name: review
description: >
  コード・PR・機能のレビューを統括し、規約遵守・文書整合・一般品質の専門レビューを起動して指摘を統合する。ユーザーが「レビューして」「PR全体をレビュー」「品質をまとめて確認して」「review this PR」「code review」「comprehensive review」と依頼したときに使う。
allowed-tools: Read, Glob, Grep, Skill, Task, Bash(git diff *), Bash(git show *), Bash(git status *), Bash(git ls-files *)
---

# review

`/review` から実行する。専門レビューを再実装せず、範囲・分担・結果の品質を管理する。

## 手順

1. `AGENTS.md` を読み、レビュー対象の ref・基準 ref・目的・変更範囲を確定する。PR なら本文・差分・関連 Issue を収集する。差分外の調査は認めるが、PR の指摘は原則として変更に由来する問題に限る。
2. `${CLAUDE_PROJECT_DIR}/.claude/skills/share/review-result.md` を読み、専門レビューへ渡す共通入力と結果の形式を確認する。
3. 対象を基に、実行する専門レビューを決める。
   - コードを含む変更は、`review-rules`・`review-docs`・`review-quality` を原則すべて起動する。文書の更新がない場合も、必要な文書更新漏れがないか `review-docs` に確認させる。
   - 文書・規約だけの変更は `review-rules`・`review-docs` を起動する。実装品質への影響がある場合は `review-quality` も起動する。
   - 対象範囲が不明な依頼は、まず対象を特定する。根拠なく専門レビューを省かない。
4. 各専門スキルを `Skill` で起動する。入力には固定 ref、対象パス、変更目的、レビュー種別（PR / 指定範囲）、検査対象外の条件を同じ形で渡す。専門スキルごとに独立した結果を受け取る。独立したコンテキストが必要なら `Task` で対象と専門スキル名を明示して委任するが、実行可能であることを確認し、実行できなければ通常の `Skill` 起動に戻す。
5. 報告された各指摘を、コード・根拠・発生条件・反証の状況で照合する。同じ根本原因による指摘だけを統合し、出典を残す。異なる原因や影響を件数合わせで潰さない。証拠が矛盾する指摘は保留して再確認する。未確認の疑義を確定 finding に昇格させない。
6. 実施した専門レビュー・未実施の専門レビュー・その理由を残し、統合した findings と保留事項を報告する。「指摘なし」を「品質保証済み」と言い換えない。レビューだけの依頼でコード・PR・Issue を変更しない。

## 入力と出力

- 入力: 対象 ref、レビュー範囲、PR の場合は基準 ref と変更目的。
- 出力: `${CLAUDE_PROJECT_DIR}/.claude/skills/share/review-result.md` の統合レビュー形式。実施した専門レビュー、統合根拠、未確認の範囲を含める。
- 個々の規約・仕様・品質の判断は `review-rules`・`review-docs`・`review-quality` に任せ、ここに基準を複製しない。

## 評価

レビューの統合機能を評価・改訂する依頼では `evals/README.md` を読み、`evals/orchestration-cases.json` の固定出力で統合を検証する。`evals/orchestration-ground-truth.md` は結果を凍結した後にのみ読む。`evals/validate-fixtures.py` は評価前に実行して入力構造を検査する。実際の専門レビューの精度は各スキルの評価ケースで別に測る。 評価データを実行確認するときは `evals/run-quality-oracles.mjs`、ブラインド入力の作成時は `evals/prepare-experiment.py`、回答を凍結するときは `evals/score-runs.py` を使用する。`evals/variants/review-quality-discover-first.md` は要素別比較のときだけ読む。
