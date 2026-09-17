# 再現性検証例

`/design-game-pictogram` の方法を、既に調整済みの2ゲームと未調整の1ゲームへ適用した検証例。

## 共通条件

- `viewBox`: `0 0 120 120`
- 実表示サイズ: 112px
- 色: `#111` / `#777` の最大2色
- gradient / filter / 外部画像 / `<text>` を使わない
- ゲーム本体の盤面を縮小コピーしない

検査コマンド:

```sh
for svg in .claude/skills/design-game-pictogram/examples/*.svg; do
  python3 .claude/skills/design-game-pictogram/scripts/check_svg.py \
    "$svg" \
    --max-colors 2 \
    --forbid-gradients \
    --forbid-filters \
    --forbid-external-images \
    --forbid-text
done
```

比較シート:

```sh
python3 .claude/skills/design-game-pictogram/scripts/make_review_sheet.py \
  --output /tmp/pictogram-review.html \
  --size 112 \
  .claude/skills/design-game-pictogram/examples/water-sort.svg \
  .claude/skills/design-game-pictogram/examples/sudoku.svg \
  .claude/skills/design-game-pictogram/examples/parking-jam.svg
```

## ウォーターソート

視覚語彙:

- 対象: 細長い容器
- 状態: 容器内の水
- 構造: 複数容器

最小構成:

- 2本の容器
- 1種類の灰色の水
- 水量差は形と余白で表現

## ナンプレ

視覚語彙:

- 構造: 正方格子
- 記号: 数字

最小構成:

- 3×3格子
- 数字2個
- 数字はフォント依存を避け、格子線と同じ線幅の幾何形状で描く

PoC中に数字が格子線へ視覚的に負けたため、意味上必要な副要素の光学的重量を確認する必要があることが分かった。

## パーキングジャム: 未調整ゲームでの再現性検証

入力は Issue #36 にある基本概念だけを使い、ウォーターソート / ナンプレの具体形状は流用しない。

視覚語彙:

- 対象: 車両
- 構造: 駐車領域
- 関係: 出口へ向く車両

初回構成:

- 出口部分だけ開いた駐車領域
- 向きの異なる3台の車両
- 出口へ向く車両だけ灰色の面で区別

結果:

- 同じ `viewBox` / 色数 / 線幅条件で生成できた
- 同じ `check_svg.py` でPASSした
- 同じ比較シート上で、既存2ゲームと弁別性・光学的重量を比較できた
- パーキングジャム専用の手順分岐は不要だった

この結果は「最終形状が正解」であることではなく、異種ゲームでも同じ設計工程と検証工程を再実行できたことの証拠として扱う。
