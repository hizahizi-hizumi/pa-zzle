# ADR

将来の意思決定に一貫性を持たせるため、プロジェクト全体の意思決定を、その背景、検討した選択肢、判断理由、帰結とともに記録する。

ADRは意思決定の記録であり、今の決まりの正本ではない。今の決まりは該当する文書かルールに書き、文書にはその Why / Why not も書く。

ADR にするのは、プロジェクト全体（ゲームをまたぐ）の意思決定に限る。1つのゲームに閉じた決定は ADR にしない。

## ファイル

- `index.csv`: ADRの検索用索引
- `ADR-NNNN-<ascii-slug>.md`: 個別ADR本文

## status

- `proposed`: 提案中
- `accepted`: 採用済み
- `deprecated`: 今は推奨しない
- `superseded by ADR-NNNN`: 別ADRで置き換え済み

## 置き換え

- 過去の ADR の本文は書き換えない。今の決まりやコードと食い違っても、決め直したら新しい ADR を残す。
- 全体を置き換えたときは、旧 ADR の `status` を `superseded by ADR-NNNN` にする。
- 一部だけを置き換えたときは、`status` は変えず、front matter の `partially_superseded_by` に置き換えたADRを並べ、本文の表題の直後に置き換えた部分を明記する。
- 置き換えたときに旧 ADR で更新するのは、`status`・`partially_superseded_by`・index.csv の status と、置き換えの注記だけにする。

今の実装や決まりを確かめるときは、ADRだけで結論を出さず、関連するコード・設定・該当する文書も確かめる。
