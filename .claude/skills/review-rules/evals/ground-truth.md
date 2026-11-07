# review-rules 評価用の正解候補

レビュー担当には渡さない。全出力を保存した後にのみ開く。合致する根拠を実際の ref のルールで検査する。

- `RULE-ARROW-DECLARATION`: `.claude/rules/typescript.md` の「関数定義」はアロー関数でなく関数宣言を使うよう求める。対象は TypeScript 規約の適用範囲で、関数をアロー式で定義している。違反が1件ある想定。`frontend/src/lib/` に配置しているため、ゲーム固有の標準配置規約は適用されない。
- `RULE-EXCLUDED-UI`: 同規約の本文に `frontend/src/components/ui/**` の明示的な適用除外がある。この規約について違反を出さない。別規約の適用を根拠なしに断定しない。
- `RULE-VALID-FUNCTION`: 関数宣言を使用し、同規約の export にも反しない。ゲーム固有の標準配置規約も適用されない。提示した断片について確認できる違反はない。
- `RULE-SKILL-TRIGGER`: `.claude/rules/skills.md` は、スキルの `description` に何をするかと使う場面、日本語・英語の起動表現を求める。`A helper.` はそれを満たさない。`SKILL.md` に対するスキル専用規約の適用が必要。

本ケースは人工的なファイル断片であり、リポジトリに実在する欠陥だと報告してはならない。別の規約に関する実在する問題が疑われても、根拠を検証してから採点する。

`RULE-ARROW-DECLARATION` と `RULE-VALID-FUNCTION` は同じパス・同じ役割で宣言方法だけを比較する。採点する前に、対象コミットの全適用規約を確認し、別規約の違反がないか検査する。
