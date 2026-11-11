@AGENTS.md

## Claude Code

- サブエージェントに `fable` を指定しない
- メインエージェントはサブエージェントにどう調査させるか、実装させるかを考える
- メインエージェントは、実装を終えて PR を作る前に `review-changes` スキルで変更をレビューし、確かめた指摘を直す
  - 変更がすべて `add-puzzle`・`design-puzzle-tutorial` の手順の中で作られ、その手順のレビューの後に変えていないときは、`review-changes` を使わない
