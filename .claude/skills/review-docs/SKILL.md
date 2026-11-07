---
name: review-docs
description: >
  指定した実装や文書を要求・要件・仕様・設計方針と照合し、文書間やコードとの不整合と更新漏れを調べる。「ドキュメント整合性レビュー」「仕様と実装を比較」「要求との矛盾を調べて」「review documentation consistency」「spec compliance review」または review からの文書検査依頼で使う。
allowed-tools: Read, Glob, Grep, Bash(git show *), Bash(git diff *), Bash(git ls-files *)
---

# review-docs

`/review-docs` で正本と実装・文書の整合性をレビューする。規約の一般的な違反とコードの内部的な品質評価は担当しない。

## 手順

1. `AGENTS.md` と `.claude/rules/documents.md` を読み、渡された固定 ref・対象パス・変更目的から、読むべき要求・要件・仕様、`APP.md`・`GAME.md`・`DESIGN.md`・画面文書・難易度文書を選ぶ。文書を変更した場合は関連ディレクトリの README も読む。
2. 実装の振る舞いと期待する振る舞いを、正本の具体的な箇所に対応付けて照合する。文書間・コードと文書間の食い違いでは `.claude/rules/documents.md` に定められた優先順位を使う。仕様が古いだけならコードの欠陥として報告しない。
3. 変更によって更新が必要になった文書と、逆に更新すべきでない資料を判別する。ADR は過去の意思決定の証拠として参照し、現行の規範と取り違えない。仕様が未確定の場合は架空の要件を作らない。
4. 違反候補の根拠を元の文書とコードまで辿り、対象の版・具体的な影響・反証を確かめる。正本自体が不足・矛盾している場合は「基準側の課題」に分ける。
5. `${CLAUDE_PROJECT_DIR}/.claude/skills/share/review-result.md` を読み、正本のパス・節・実装箇所と検証状態を報告する。外部状態を変更しない。

## 評価

このスキルの評価・改訂時は `evals/cases.json` の入力だけでレビューを実行し、出力を確定した後に `evals/ground-truth.md` と比較する。優先順位や ADR の誤用による誤検出も測る。
