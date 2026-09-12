# MADR 執筆ルール (AmuQuery運用)

`adr-create` Skill が `assets/adr-template.md` を展開する際に従うルール。テンプレート自体には指示を書かず、本ファイルに執筆規約を集約する。

MADR v3 の章立てを日本語化して採用する。ADR は判断履歴であり、現在仕様の正本ではない。決定によって現在仕様が変わる場合は、`AGENTS.md` が指定する該当文書・CSV・コード等も別途更新する。

## 章立てルール

| 章 | 必須/任意 | why |
|---|---|---|
| frontmatter `status` / `date` | 必須 | `status` がないと supersede 連鎖を追えず、`date` がないと時系列で再評価できない。初期値は原則 `proposed` |
| frontmatter `deciders` | 任意 | 判断主体を残す必要がある場合のみ使う |
| `# タイトル` | 必須 | 短く意思決定の主題を表す |
| `## 要約` | 必須 | `決定` / `主な選択肢` / `背景` / `要約` の4項目。最後の `要約` は `dev/docs/adr/index.csv` の `summary` と完全一致させる |
| `## 背景と問題` | 必須 | 将来、当時の制約を再評価できるようにする |
| `## 判断基準` | 任意 | 判断軸が複数ある場合に書く |
| `## 検討した選択肢` | 必須 | 原則2案以上。採用しなかった案も残す |
| `## 採用した選択肢と理由` | 必須 | `採用: <名前>。理由: <理由>。` で開始する |
| `### 帰結` | 必須 | Good / Bad の両方を最低1行ずつ書く |
| `## 各選択肢の良し悪し` | 任意 | 比較の詳細が将来の再評価に有用な場合に書く |
| `## 補足` | 任意 | 関連 ADR / Issue / PR / 参考 URL 等 |

## 章名対応表

| 本リポ和訳 | MADR v3 原文 |
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

`dev/docs/adr/ADR-<NNNN>-<ascii-slug>.md`

- `<NNNN>` は4桁ゼロ埋めの連番。既存最大 + 1
- ADR本文とindexのタイトルは日本語でよい。
- `<ascii-slug>` はタイトルの意味を表す短い英語の lowercase kebab-case とし、ASCII英小文字・数字・ハイフンだけを使う。
- `dev/**` 配下へ非ASCIIのパスを作らない。

## index.csv 追記行

`dev/docs/adr/index.csv` は6カラム: `id,title,summary,status,date,path`。

```csv
ADR-<NNNN>,<タイトル>,<3文ほどの概要>,<status>,<YYYY-MM-DD>,<相対パス>
```

例:

```csv
ADR-0002,SQL実行環境をローカルEmulatorへ統一,"SQL実行の標準ローカル環境をEmulatorへ統一する。検討案はローカルEmulator / 実サービスの2案。反復性と課金不要を優先し、サービス固有能力だけ別環境へ分離する。",proposed,2026-08-22,dev/docs/adr/ADR-0002-local-emulator-runtime.md
```

カンマ・改行・ダブルクォートを含むフィールドは RFC 4180 に従ってエスケープする。`summary` は原則ダブルクォートで囲む。

### summary の書き方

3文程度・100〜200字を目安に、次を圧縮する。

1. 何を決めたか
2. 検討した選択肢
3. 決め手

`adr-reference` が `index.csv` を一次検索するため、検索対象にしたい技術名・概念・契約名を含める。

### CSV summary と本文要約の同期

CSV の `summary` と、ADR 本文 `## 要約` の4項目目 `要約` は完全に同一文字列にする。片方を変更した場合は必ずもう片方も変更する。

## 現在仕様との関係

- ADR だけを更新して現在仕様を変えた扱いにしない
- ADR に過去仕様の完全なスナップショットを保存しない
- 現在仕様の正本は `AGENTS.md` が指定する各文書・CSV・コードとする
- ADR は「決定時の背景・比較・理由・帰結」を保存する
