# MADR 執筆ルール

`assets/adr-template.md` から ADR を書くときの決まり。MADR v3 の章立てを日本語にして使う。

## 章立てルール

| 章 | 必須/任意 | 書くこと |
|---|---|---|
| frontmatter `status` | 必須 | 値は `docs/adr/README.md` の「status」から選ぶ。初期値は原則 `proposed` |
| frontmatter `date` | 必須 | 作った日を `YYYY-MM-DD` で書く |
| frontmatter `deciders` | 任意 | 判断した人を残すときだけ書く |
| frontmatter `partially_superseded_by` | 任意 | 新しい ADR には付けない |
| `# タイトル` | 必須 | 意思決定の主題を短く書く |
| `## 要約` | 必須 | `決定` / `主な選択肢` / `背景` / `要約` の4項目を書く |
| `## 背景と問題` | 必須 | 決定したときの制約と解きたい問題を書く |
| `## 判断基準` | 任意 | 判断の軸が複数あるときに書く |
| `## 検討した選択肢` | 必須 | 採用しなかった案を含めて2案以上を書く |
| `## 採用した選択肢と理由` | 必須 | `採用: <名前>。理由: <理由>。` で始める |
| `### 帰結` | 必須 | Good と Bad をそれぞれ1行以上書く |
| `## 各選択肢の良し悪し` | 任意 | 比べた詳しい内容を残すときに書く |
| `## 補足` | 任意 | 関連する ADR・Issue・PR・参考 URL と、置き換える ADR とその部分を書く |

## 章名対応表

| 本リポの章名 | MADR v3 原文 |
|---|---|
| 要約 | 本リポ独自 |
| 背景と問題 | Context and Problem Statement |
| 判断基準 | Decision Drivers |
| 検討した選択肢 | Considered Options |
| 採用した選択肢と理由 | Decision Outcome |
| 帰結 | Consequences |
| 各選択肢の良し悪し | Pros and Cons of the Options |
| 補足 | More Information |

## ファイル名規約

`docs/adr/ADR-<NNNN>-<ascii-slug>.md`

- `<NNNN>` は4桁にゼロ埋めした連番にする
- `<ascii-slug>` はタイトルの意味を表す短い英語を lowercase kebab-case で書き、ASCII の英小文字・数字・ハイフンだけを使う
- 本文と index.csv のタイトルは日本語で書く

## index.csv 追記行

`docs/adr/index.csv` は `id,title,summary,status,date,path` の6カラムにする。

```csv
ADR-<NNNN>,<タイトル>,<summary>,<status>,<YYYY-MM-DD>,<相対パス>
```

```csv
OK:
ADR-0001,API境界をHTTPで統一,"フロントエンドとバックエンドの境界をHTTP APIに統一する。直接呼び出しとHTTP APIを比較した。実行環境を分離しても同じ契約を維持できることを優先した。",proposed,2026-09-13,docs/adr/ADR-0001-http-api-boundary.md
```

- カンマ・改行・ダブルクォートを含むフィールドは RFC 4180 に従ってエスケープする
- `summary` は原則ダブルクォートで囲む

## summary の書き方

- 3文・100〜200字を目安に、何を決めたか・検討した選択肢・決め手を書く
- 検索で見つけたい技術名・概念名・契約名を入れる
- 本文の `## 要約` の `要約` と index.csv の `summary` は同じ文字列にする
