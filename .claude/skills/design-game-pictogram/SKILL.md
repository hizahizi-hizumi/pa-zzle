---
name: design-game-pictogram
description: >
  This skill should be used when designing, refining, reviewing, or validating a game-selection pictogram,
  game pictogram, puzzle pictogram, game icon, or SVG used to identify a game in the pa-zzle game list.
  It turns a game concept and display constraints into a reproducible SVG design process, runs deterministic
  SVG checks and comparison-sheet generation, and records the reasoning needed to reproduce the result.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# design-game-pictogram

ゲーム一覧でゲームを識別するためのピクトグラムを、再現可能な手順で設計・検証する Skill。

## 起動

`/design-game-pictogram`

対象ゲーム、表示サイズ、色数などの制約を引数または会話 context から受け取る。

## 成果物

各実行で次を残す。

- SVG ピクトグラム案
- 何を識別特徴として採用・不採用にしたかの短い設計記録
- `scripts/check_svg.py` の検査結果
- `scripts/make_review_sheet.py` で生成した実サイズ比較シート
- 人間確認で見つかった問題と、それに対する変更理由

最終成果物は特定ゲームの絵そのものではなく、同種のゲーム追加でも再実行できる設計過程である。

## 動作フロー

### 1. 入力条件を固定する

次を最初に明文化する。

- 対象ゲームと、プレイヤーが実際に見る主要な対象・構造・記号
- ピクトグラムが使われる場所と実表示サイズ
- SVG の `viewBox`
- 使用可能な色、色数、透過の可否
- 線幅、塗り、角、文字使用などの既存制約
- 比較対象となる既存ピクトグラム群

制約が未指定なら勝手にブランド規則を作らず、現在の一覧実装と対象 Issue の条件から実験条件を置く。

### 2. ゲームの視覚語彙を列挙する

ゲーム画面を縮小コピーせず、次の観点で候補を列挙する。

- **対象**: 容器、車、数字、駒など、ゲーム中に実際に見る物体
- **構造**: 格子、並び、積層、出口、接続など、ゲームを特徴付ける空間関係
- **状態・記号**: 数字、水、向き、空き、境界など、対象だけでは不足する識別情報
- **関係・動作**: 並べ替え、移動、流入など、静止画でも必要なら示す関係

この段階では「必ず2個」などの固定個数を課さない。

### 3. 意味的距離を縮める最小構成を作る

`references/method.md` の評価軸を使い、ゲーム名を読まなくても対象ゲームまたは十分近い概念へ結びつく構成を探す。

- まず具体的で、ゲーム中に実在する対象・構造から始める
- 同じ種類の情報を増やすより、役割の違う情報を組み合わせる
- 状態の忠実再現にしか寄与しない細部を削る
- 削った結果、汎用記号へ戻ったら識別に必要な情報を1つ戻す

ウォーターソートで「容器だけ」、ナンプレで「格子だけ」のように、意味的距離が大きくなる抽象化は採用しない。

### 4. 視覚複雑性を抑える

認識に必要な情報を維持したまま、次の順で情報量を下げる。

1. 不要な対象を減らす
2. 状態の種類を減らす
3. 余白と配置で分離する
4. 線密度を下げる
5. 色を追加せずに成立するか確認する

「単純にする」こと自体を目的にせず、意味的距離を悪化させない範囲で簡素化する。

### 5. 光学的重量を合わせる

同じ `viewBox` や数値寸法だけでは揃わないため、実表示サイズで確認する。

- 識別に必要な要素が他要素に負けていないか
- 外形の占有率が他ゲームと極端に違わないか
- 線の密度や黒量が一覧内で突出していないか
- 幾何学的中央ではなく、見た目として中央に見えるか

必要な要素が弱い場合、要素を増やす前に線幅・大きさ・位置・余白を調整する。

### 6. 機械検査を実行する

SVG を作成したら次を実行する。

```sh
python3 .claude/skills/design-game-pictogram/scripts/check_svg.py path/to/pictogram.svg
```

色数などの条件がある場合は明示する。

```sh
python3 .claude/skills/design-game-pictogram/scripts/check_svg.py \
  path/to/pictogram.svg \
  --max-colors 2 \
  --forbid-gradients \
  --forbid-filters \
  --forbid-external-images
```

この検査は構文・色数・外部依存等を検出する。意味の分かりやすさや光学的重量を自動判定したものとは扱わない。

### 7. 実サイズ比較シートを作る

候補 SVG と既存ピクトグラムを同じ条件で並べる。

```sh
python3 .claude/skills/design-game-pictogram/scripts/make_review_sheet.py \
  --output /tmp/pictogram-review.html \
  --size 112 \
  water-sort.svg sudoku.svg parking-jam.svg
```

最低でも次を人間が確認する。

- 各構成要素を意図した対象・形として知覚できるか
- ゲーム名を隠しても他ゲームと区別できるか
- 一覧として一つだけ強すぎたり弱すぎたりしないか
- 小サイズで線や隙間が潰れていないか

### 8. 観察から修正する

修正は「なんとなく」ではなく、観察と変更理由を対にする。

例:

- `数字が格子線に負ける` → 数字の線幅を格子線に合わせる
- `盤面全体の縮小に見える` → 状態の種類とセル数を削る
- `汎用グリッドに見える` → ナンプレ固有の数字情報を戻す

変更後は機械検査と比較シート確認を再実行する。

## 評価軸

詳細は `references/method.md` を参照する。

- 意味的距離
- 構成要素の知覚可能性
- 視覚複雑性
- 具体性
- 一覧内での弁別性
- 光学的重量
- 実表示サイズでの成立

「きれい」「好み」といった総評だけで採否を決めない。

## 外部根拠

一般的なピクトグラム・アイコン設計と評価に関する根拠は `references/research.md` を参照する。

この Skill 固有の方法が外部知見から導いたものか、pa-zzle の PoC で得た仮説かを混同しない。

## 再現性の確認

方法を変更した場合、既に調整済みのウォーターソート / ナンプレだけで有効性を判断しない。

別種のゲームを1つ選び、既存ピクトグラムの具体形を参照せずに Step 1 から実行する。次が成立すれば再現性の証拠とする。

- 同じ工程で候補生成まで到達できる
- 機械検査を同じコマンドで実行できる
- 比較シートで既存ゲーム群と同じ評価軸を適用できる
- 特定ゲーム専用の例外規則を追加せずに修正理由を説明できる

## 制約

- `DESIGN.md` をこの Skill の成果物として変更しない
- ゲーム本体コンポーネントの縮小・再利用を目的にしない
- ゲーム固有図形の無理な共通コンポーネント化をしない
- 機械検査で主観評価を代替したと主張しない
- SVG 内に実装履歴や PoC 経緯をコメントとして残さない
