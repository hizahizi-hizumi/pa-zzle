---
name: adr-reference
description: >
  This skill should be used when the user asks to "/adr-reference", "ADR を参照",
  "ADR を見る", "意思決定の経緯を確認", "既存 ADR を探す", "ADR 検索",
  "過去の意思決定を確認", "なぜこう決めたか確認", "look up ADR",
  "find decision record", "read decision record". Looks up existing Any Decision Records
  under docs/adr/ by ADR-NNNN identifier or free-text keyword. Uses docs/adr/index.csv
  as the primary search target and reads ADR bodies only when needed.
argument-hint: "<ADR-NNNN | keyword>"
allowed-tools: Read, Glob, Grep
---

# adr-reference

pa-zzleの既存 ADR を参照し、過去の意思決定の背景・比較・理由を確認する Skill。設計・実装・レビュー・新規 ADR 起票時に使う。

`docs/adr/index.csv` を一次情報源として使い、本文 Read を最小化する。ADR は意思決定の記録で今の決まりの正本ではないため、「今どうなっているか」の確認では ADR だけで結論を出さず、関連するコード・設定・該当する文書も確認する。

## 起動

`/adr-reference <ADR-NNNN | keyword>`

- `^ADR-\d{4}$` にマッチする場合: ID 指定モード
- それ以外: キーワード検索モード
- 引数が空なら ID またはキーワードの指定を求めて停止する

## A. ID 指定モード

1. `docs/adr/ADR-<NNNN>-*.md` を Glob する。
2. 0件なら `references/output-format.md` の0件形式で返す。
3. 1件なら当該ファイルを Read し、frontmatter と本文を表示する。
4. 2件以上なら連番重複の仕様違反として停止し、該当パスを列挙する。
5. `status` が `superseded by ADR-NNNN` の場合は置き換え先を、front matter に `partially_superseded_by` がある場合は置き換え先と置き換えた部分を必ず併記する。

## B. キーワード検索モード

### 1. index.csv を一次検索

- `docs/adr/index.csv` をキーワードで Grep する。
- `id` / `title` / `summary` / `status` / `date` / `path` のいずれかにヒットした行を候補にする。
- CSV で十分な場合は ADR 本文を Read しない。ただし手順3の置き換えの確認は行う。

### 2. ADR 本文を fallback 検索

次の場合のみ `docs/adr/ADR-*.md` を Grep する。

- index.csv で0件
- 詳細な固有名詞・数値・コード断片など、summary に出にくい語を探している
- ユーザーが本文レベルの検索を明示している

本文ヒット時は対応する index.csv 行から summary を取得する。

### 3. 結果を統合

- ファイル単位で重複排除する。
- `references/output-format.md` に従って最大10件表示する。
- 10件超の場合は連番が新しい順で上位10件のみ表示し、絞り込みを促す。
- `status` が superseded の場合と、`partially_superseded_by` がある場合は置き換え先を警告する。
  - `status` は index.csv で分かる。`partially_superseded_by` は index.csv に無く ADR の front matter にだけあるため、`docs/adr/ADR-*.md` を `^partially_superseded_by:` で Grep し、候補に該当する ADR があるか確かめる。
  - 該当する ADR は、front matter と表題直後の置き換えの注記だけを Read し、置き換え先と置き換えた部分を得る。本文全体は Read しない。

## 本文展開が必要な場合

ID 指定以外でも、次の場合は ADR 本文を Read する。

- ユーザーが全文・詳細を求めた
- 選択肢の Pros/Cons や帰結を確認しないと判断できない
- supersede 関係を詳細に追う必要がある

最初から全件本文を Read しない。

## 今の決まりを確認する場合

ADR は意思決定の記録で、今の決まりの正本ではない。今の決まりとその Why / Why not は該当する文書にある。ユーザーの質問が今の決まり・今の実装を求める場合は、該当 ADR の内容だけで回答せず、次を行う。

1. ADR から意思決定の背景・比較・理由と関連する論点を把握する。
2. `AGENTS.md` の文書案内と、関連するコード・設定・該当する文書を Read する。
3. 今の実装・文書と ADR が食い違う場合は今の事実を優先し、ADR の `status` / `partially_superseded_by` の管理が古い可能性を指摘する。

## 参照する真実情報

- `references/output-format.md` — 出力フォーマット
- `docs/adr/index.csv` — ADR 一覧・一次検索対象
- `docs/adr/README.md` — ADR 運用方針
- `docs/adr/ADR-*.md` — 個別 ADR 本文
- `AGENTS.md` — 文書の位置付け

## 制約

- 起動 context: inline。
- 参照専用。ADR や index.csv を書き換えない。
- 一時ファイルを書き出さない。
- 10件超を一度に本文展開しない。
- superseded な ADR と、`partially_superseded_by` がある ADR の置き換えた部分を、今の方針として提示しない。
- 今の決まりを問われた場合に ADR だけで回答を確定しない。
