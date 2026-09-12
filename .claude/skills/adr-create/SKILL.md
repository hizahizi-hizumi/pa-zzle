---
name: adr-create
description: >
  This skill should be used when the user asks to "/adr-create", "ADR を作成", "新規 ADR",
  "意思決定を記録", "ADR 起票", "MADR で書く", "decision を残したい",
  "なぜそう決めたか残す", "create ADR", "record a decision", "write a decision record".
  Creates a new ADR (Any Decision Record) under dev/docs/adr/, assigns the next NNNN sequence
  number, and appends a row to dev/docs/adr/index.csv with a searchable summary. Optional
  argument is a short Japanese ADR title; the filename uses an ASCII slug.
argument-hint: "<日本語タイトル>?"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(date *)
---

# adr-create

AmuQueryの重要な意思決定を MADR v3 ベースの ADR として作成する Skill。対象はアーキテクチャだけでなく、学習設計・採点方式・実行環境・問題契約・運用・ワークフローなど、将来判断理由を再評価する価値がある決定全般。

## 起動

`/adr-create [<日本語タイトル>]`

- `<日本語タイトル>`: ADR本文とindexで使う短いタイトル。省略時は会話 context から提案して確認する。
- ファイル名にはタイトルの意味を表す短い英語ASCII slugを使う。

## 動作フロー

### 1. 運用基盤を確認

- `dev/docs/adr/README.md` と `dev/docs/adr/index.csv` が存在することを確認する。
- どちらかがなければ ADR 運用基盤が不完全として停止する。
- `dev/docs/adr/README.md` を Read し、ADR と現在仕様の正本を混同しないことを確認する。

### 2. ADR にするべき判断か確認

- 単発バグ修正、局所的リファクタリング、誤字修正、単純なデータ追加であれば ADR を作らず、commit / PR 履歴で十分と判断する。
- 技術・実行環境・学習設計・採点・契約・公開境界・横断運用など、複数案の比較や将来の再評価価値がある判断なら続行する。
- ADR は現在仕様の代替ではない。決定によって現在仕様が変わる場合、該当する正本の更新も必要であることを作業結果に明示する。

### 3. 連番採番

- `dev/docs/adr/ADR-*.md` を Glob する。
- ADR が0件なら `0001` を採番する。
- 既存ADRがある場合は、ファイル名の `NNNN` 最大値 + 1 を4桁ゼロ埋めして新しい番号にする。
- 同一番号が複数存在しないことを確認する。

### 4. タイトルとslugを確定

- 引数があればADRタイトルとして使用する。
- 未指定なら会話 context から日本語タイトルを1つ提案して確認する。
- タイトルの意味を表す短い英語slugを lowercase kebab-case で作る。使用できる文字はASCII英小文字・数字・ハイフンだけとする。
- ファイル名は `ADR-<NNNN>-<ascii-slug>.md` とし、`dev/**` のASCII-only規約を守る。

### 5. 日付取得

- `Bash(date +%Y-%m-%d)` で日付を取得し、frontmatter の `date` に入れる。

### 6. summary を生成

- `references/madr-authoring-rules.md` に従い、3文・100〜200字程度で次を含める。
  1. 何を決めたか
  2. 主な選択肢
  3. 決め手
- 検索対象にしたい技術名・概念名を含める。
- この summary 文字列を ADR 本文 `## 要約` の `要約` と `dev/docs/adr/index.csv` の `summary` に同一文字列で使用する。

### 7. ADR を作成

- `assets/adr-template.md` を Read する。
- `references/madr-authoring-rules.md` を Read する。
- 会話 context から埋められる内容は埋める。判断に必要な情報が不足する箇所は `<...>` のまま残さず、ADR を `proposed` として不確定点を本文で明示するか、作成前に必要な判断を確認する。
- 検討した選択肢は原則2案以上にする。
- `### 帰結` には Good / Bad の両方を最低1件書く。
- `dev/docs/adr/ADR-<NNNN>-<ascii-slug>.md` に Write する。

### 8. index.csv を更新

- `dev/docs/adr/index.csv` の末尾に1行追記する。
- 6カラム `id,title,summary,status,date,path` を維持する。
- `summary` は本文と完全一致させる。
- CSV 全体を書き直さず Edit で末尾へ追加する。

### 9. 整合確認

- ADR 本文の `status` / `date` / title と index.csv 行が一致することを確認する。
- 本文 `要約` と CSV `summary` が同一文字列であることを確認する。
- 同じ論点の既存 ADR がある場合、置き換えなのか補完なのかを確認する。置き換えなら旧 ADR の status を勝手に変更せず、必要な supersede 操作をユーザーへ提示する。

### 10. 報告

- 作成した ADR パス
- index.csv に追記した行
- status
- 現在仕様側で別途更新が必要な正本があればその候補
- `proposed` の場合は残っている判断点

## 参照する真実情報

- `assets/adr-template.md` — ADR 本文テンプレート
- `references/madr-authoring-rules.md` — 執筆・命名・CSV・現在仕様との分離ルール
- `dev/docs/adr/README.md` — ADR 運用方針と status 定義
- `dev/docs/adr/index.csv` — ADR 一覧
- `dev/docs/adr/ADR-*.md` — 採番・既存判断確認対象
- `AGENTS.md` — AmuQueryで現在仕様の正とするもの、変更の進め方

## 制約

- 起動 context: inline。
- `index.csv` への追記を省略しない。
- 本文 `要約` と CSV `summary` を別々の文章にしない。
- ADR を現在仕様の正本として扱わない。
- 既存 ADR の status を自動で書き換えない。
- `dev/**` 配下へ非ASCIIのパスを作らない。
- 自動コミット / 自動 PR は作成しない。
