# adr-reference の出力形式

## ID 指定

1件:

```markdown
### ADR-0001: API境界をHTTPで統一する
- status: accepted / date: 2026-09-13
- パス: docs/adr/ADR-0001-http-api-boundary.md

---

<ADR 本文の全文>
```

0件:

```text
ADR-<NNNN> は見つかりません。docs/adr/ 配下に該当ファイルなし。
連番の typo または欠番を確認してください。
```

2件以上: 連番の重複として、該当するパスを並べる。

## キーワード検索

- ADR ごとに次の形式で、`summary` を必ず入れて示す
- 10件を超えたら連番の新しい順に10件だけ示し、キーワードを絞るようユーザーに求める

```markdown
### マッチ <N> 件 (キーワード: "<keyword>")

- **ADR-0001** (status: accepted, date: 2026-09-13): API境界をHTTPで統一する
  - パス: docs/adr/ADR-0001-http-api-boundary.md
  - 概要: <index.csv の summary>
  - ヒット位置: index.csv (本文 Read 省略)
```

本文だけでヒットした ADR:

```markdown
- **ADR-0007** (status: accepted, date: <date>): <タイトル>
  - パス: <path>
  - 概要: <index.csv の summary>
  - ヒット位置: 本文 (index.csv では非ヒット)
  - 該当箇所: "..."
```

0件:

```text
キーワード "<keyword>" でマッチする ADR は見つかりません。
- docs/adr/index.csv
- docs/adr/ADR-*.md
の両方を検索しました。別キーワードを試してください。
```

## supersede 状態

`status` が `superseded by ADR-<NNNN>` の ADR:

```markdown
- **ADR-0003** (status: SUPERSEDED → ADR-0009, date: <date>): <旧タイトル>
  - パス: <path>
  - 概要: <summary>
  - ⚠ ADR-0009 で置き換え済み。今の判断は置き換え先を参照すること。
```

front matter に `partially_superseded_by` がある ADR は、`status` をそのまま示し、置き換え先と表題直後の注記にある置き換えた部分を示す:

```markdown
- **ADR-0003** (status: accepted, 一部置き換え → ADR-0013, date: <date>): <タイトル>
  - パス: <path>
  - 概要: <summary>
  - ⚠ 一部を ADR-0013 で置き換え済み。置き換えた部分: <表題直後の注記の要点>。この部分の今の判断は置き換え先を参照し、それ以外は有効。
```
