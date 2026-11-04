---
paths:
  - "frontend/styles/globals.css"
---

# デザイントークン編集ルール

`frontend/styles/globals.css` の `@theme` と、それが参照する変数を編集する際のルール。

- トークンを追加・削除・改名する前、または値の変更でトークンの意味や使い分けが変わる前に、`DESIGN.md` を読む
- 追加するトークンは、意味と使い分けを `DESIGN.md` に定義する。定義できないものは足さない
- トークンを追加・削除・改名したら、同じ変更の中で `DESIGN.md` の定義も揃える
  - `DESIGN.md` はトークン名を、先頭の `--` を除き、色のトークンは `--color-` も除いた名前で書いている（`--color-primary` は `primary`）。その名前で `DESIGN.md` を探す
- 意味や使い分けを変えない値の調整では `DESIGN.md` を変えない
- `DESIGN.md` に意味が定義されていない既存のトークン（shadcn/ui 由来の `chart-*`・`sidebar-*` など）は、共通UIで使い始める変更の中で意味と使い分けを定義する
