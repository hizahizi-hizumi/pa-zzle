# レビュースキル評価データの修正と検証（2026-11-07）

## 実測済みの事実

- 旧版の独立レビュー36実行は [PR #658 のコメント](https://github.com/hizahizi-hizumi/pa-zzle/pull/658#issuecomment-6703600633) に記録されている。確定した既知陽性6件についてスキルなし／ありはともに5件検出した。探索的評価ではスキルなし8/10、あり6/10で、改善は確認されていない。未裁定の指摘があるため適合率は確定していない。
- 今回、一般品質の確定評価に2対を追加し、CLAMP・IMMUTABLE・STALEの3対、計6ケースを作成した。
- `node .claude/skills/review/evals/run-quality-oracles.mjs` で14回の契約検査を実行した（各実装の検査回数の合計）。修正前の3実装では合計5回の契約違反、修正後の3実装では0回。これはモデルの検出結果ではない。
- `python3 .claude/skills/review/evals/validate-fixtures.py` は規約4・文書3・一般品質12・統括3の計22ケースで成功した。履歴の6ケースは、従前どおり探索的評価に限定した。
- `prepare-experiment.py` は、一般品質の12ケースについて2群24入力と、発見先行候補を含む3群36入力を生成できることを確認した。前後ラベル・正解・採点区分はレビュー担当向けの入力には含まない。独立した新規コンテキストを実行できた証拠ではない。

## 今回実行できていない項目

- 独立LLMを使った新しいスキルなし／あり比較。今回の環境には、呼び出せる Claude Code・Codex・Gemini CLIおよび独立LLMエージェントの実行手段が見つからなかった。
- 自動起動の成功率、修正後セットでの適合率・再現率・F1、改善候補のアブレーション効果、トークン/API費用。
- 履歴の画面依存事象の実機再現、外部正本から独立した実際の欠陥ラベルの追加確認。

## 判断

- 旧版の結果から「評価が悪かっただけ」とするのは誤り。現行スキルの有効性は立証されておらず、早期の反証によって候補が失われる可能性は残る。
- 今回は実運用のSKILL.mdのレビューフローを維持し、発見先行を1文だけ追加する案を評価用に分離した。アブレーションで誤検出・コスト増なしの改善が確認されるまでは採用しない。
- 3つの人工的な欠陥はレビュー能力の回帰検査に使えるが、製品全体の一般品質の代表性はない。既存履歴を探索的に残し、新しい実害ベースの確定ケースを継続して集める必要がある。

## 実験の再現

```sh
python3 .claude/skills/review/evals/validate-fixtures.py
node .claude/skills/review/evals/run-quality-oracles.mjs
python3 .claude/skills/review/evals/prepare-experiment.py --output /tmp/pa-zzle-review-run-001 --seed review-2026-11-07 --domain review-quality
# 実際の独立LLM実行で各 <run>.txt を保存した後だけ、回答のハッシュ固定を行う
python3 .claude/skills/review/evals/score-runs.py --experiment /tmp/pa-zzle-review-run-001 --results <run単位の実行結果を格納したパス> --output /tmp/pa-zzle-review-run-001-hashes.json
```

`prepare-experiment.py` の出力のうち、レビュー担当に渡すのは `reviewer-inputs` のみとする。評価担当の `evaluator-only-manifest.json` は渡さない。対象版のコードへのアクセスも閉じた断面で提供し、Git履歴から修正理由が漏れる状態で比較しない。
