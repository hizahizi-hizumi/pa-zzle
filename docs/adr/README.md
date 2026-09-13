# ADR

重要な意思決定の背景、検討した選択肢、判断理由、帰結を記録する。
ADRは判断履歴であり、現在仕様そのものの正本ではない。

## ファイル

- `index.csv`: ADRの検索用索引
- `ADR-NNNN-<ascii-slug>.md`: 個別ADR本文

## status

- `proposed`: 提案中
- `accepted`: 採用済み
- `deprecated`: 現在は推奨しない
- `superseded by ADR-NNNN`: 別ADRで置き換え済み

現在の実装や仕様を確認するときは、ADRだけで結論を出さず、関連するコード・設定・現行文書も確認する。
