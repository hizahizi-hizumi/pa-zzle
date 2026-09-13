# adr-reference 出力フォーマット仕様

メインコンテキストに Markdown で表示する。一時ファイルへは書き出さない。

## A. ID 指定 (`ADR-NNNN`)

ヒット1件:

```markdown
### ADR-0001: API境界をHTTPで統一する
- status: accepted / date: 2026-09-13
- パス: docs/adr/ADR-0001-http-api-boundary.md

---

<ADR 本文を全文展開>
```

ヒット0件:

```text
ADR-<NNNN> は見つかりません。docs/adr/ 配下に該当ファイルなし。
連番の typo または欠番を確認してください。
```

ヒット2件以上は連番重複の仕様違反として停止し、該当パスを列挙する。

## B. キーワード検索

最大10件まで、各ADRを次の形式で返す。`summary` は必ず表示する。

```markdown
### マッチ <N> 件 (キーワード: "<keyword>")

- **ADR-0001** (status: accepted, date: 2026-09-13): API境界をHTTPで統一する
  - パス: docs/adr/ADR-0001-http-api-boundary.md
  - 概要: <index.csv の summary>
  - ヒット位置: index.csv (本文 Read 省略)
```

本文 fallback でのみヒットした場合:

```markdown
- **ADR-0007** (status: accepted, date: <date>): <タイトル>
  - パス: <path>
  - 概要: <index.csv の summary>
  - ヒット位置: 本文 (index.csv では非ヒット)
  - 該当箇所: "..."
```

ヒット0件:

```text
キーワード "<keyword>" でマッチする ADR は見つかりません。
- docs/adr/index.csv
- docs/adr/ADR-*.md
の両方を検索しました。別キーワードを試してください。
```

10件超の場合は連番が新しい順で上位10件のみ表示し、絞り込みを促す。

## supersede 状態

`status` が `superseded by ADR-<NNNN>` の場合は必ず置き換え先を明示する。

```markdown
- **ADR-0003** (status: SUPERSEDED → ADR-0009, date: <date>): <旧タイトル>
  - パス: <path>
  - 概要: <summary>
  - ⚠ ADR-0009 で置き換え済み。現在の判断は置き換え先を参照すること。
```

## 現在仕様との関係

ADR は判断履歴であり、現在仕様の正本ではない。ユーザーが「現在どうなっているか」を尋ねている場合、ADRだけで回答を確定せず、関連するコード・設定・現行文書も確認する。
