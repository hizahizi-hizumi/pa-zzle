---
paths:
  - "frontend/src/games/**/*.{ts,tsx}"
---

# ゲーム実装の標準構造

## 原則

- ゲームごとに同じ責務は同じ名前・同じ位置に置き、同じ依存方向を保つ。
- 実装方式ではなく責務で配置する。`hooks`、`services`、`utils`、`manager`、`game` のような技術分類・汎用箱を責務の代わりに使わない。
- 標準責務を省略する理由を、実装量が少ない・今は使わないといった実装都合にしない。
- 責務が存在しないファイルやディレクトリを、構造を揃えるためだけに空で作らない。
- 別ゲームの実装を直接 import しない。複数ゲームで同じ意味を持つゲーム共通契約は `frontend/src/games/` 直下へ置き、特定ゲームやUIの所有物にしない。

## 標準配置

各 `frontend/src/games/<game>/` は、責務が存在する限り次の配置を使う。

```text
<game>/
├── puzzle/
├── problem/
│   ├── problem.ts
│   ├── generator.ts
│   └── difficulty-analysis.ts
├── session/
│   └── session.ts
├── play/
│   └── use-<game>-play.ts
├── ui/
├── assets/
├── difficulty.ts
├── score.ts
├── problem-selection.ts
├── play-record.ts
└── diagnostics.ts
```

### 原則必須

- `puzzle/`: パズルの状態・ルール・合法手・解法など、遊び方そのものを置く。
- `problem/problem.ts`: 1問を遊ぶために必要なデータ契約を置く。
- `session/session.ts`: 1問に対する1回のプレイ状態・操作・経過事実を置く。
- `play/use-<game>-play.ts`: 問題供給、セッション、評価などを組み合わせ、UIへプレイ状態と操作を提供する。
- `ui/`: ゲーム固有の表示とユーザー操作の受け渡しを置く。
- `difficulty.ts`: ゲームとしての難易度ラベル・分類方針を置く。
- `score.ts`: 完了したプレイの事実をゲーム固有の評価へ変換する。
- `problem-selection.ts`: 開始条件に合う問題を問題供給元と難易度方針から選ぶ。
- `play-record.ts`: ゲーム固有の完了事実をアプリ共通の記録機能へ接続する。

原則必須の責務を省略する場合は、`APP.md` / `GAME.md` を確認し、そのゲームだけ当該体験を持たないことがゲーム仕様として説明できる場合に限る。

### 条件付き

- `problem/generator.ts`: 実行時に問題を生成する場合に置く。固定問題集や外部問題を選ぶだけなら置かない。
- `problem/difficulty-analysis.ts`: 問題そのものから難易度判定用の特徴を導出する場合に置く。難易度が問題データの既知情報なら置かない。
- `puzzle/solver.ts`: 解探索が問題生成・検証・解析などに必要な場合に置く。
- `diagnostics.ts`: ゲーム固有の内部診断情報を提供する場合に置く。
- `assets/`: ゲーム固有の静的資産がある場合に置く。

## 責務境界

- `puzzle/` は問題生成、難易度、セッション、採点、記録、React、UIを知らない。
- `problem/` は1問の表現・生成・復元・問題自体の解析に集中し、セッション、採点、記録、React、UIを知らない。
- `session/` はプレイ中に起きた事実だけを管理し、問題生成、難易度分類、採点、保存、React、UIを知らない。
- `difficulty.ts` は問題解析結果をゲーム上の難易度へ意味付けし、問題生成やプレイ進行を行わない。
- `score.ts` は入力されたプレイ事実を評価し、セッション更新、記録保存、UI表現を行わない。
- `problem-selection.ts` は問題供給と難易度方針を調停し、生成アルゴリズムや難易度判定ロジック自体を持たない。
- `play/` は下位責務を調停する。表示実装を持たず、`ui/` を import しない。
- `ui/` は表示と入力を担当し、問題生成、セッション更新、採点規則を実装しない。
- `play-record.ts` は記録機能との接続に集中し、プレイ進行を持たない。
- `diagnostics.ts` は診断用の変換・復元に集中し、通常プレイの判断に使わない。

## 問題契約

- `<Game>Problem` には、その1問を実際に遊ぶために必要なデータだけを含める。
- seed、生成器の版、生成試行回数など再現用情報は `<Game>ProblemIdentity` として分離する。
- `<Game>GeneratedProblem` には identity、問題解析結果、下流で必要な派生情報だけを含める。\n- 解探索の手順・探索履歴など生成内部だけで必要な情報は外へ公開せず、下流で必要なら `optimalMoveCount` のような意味のある派生値へ縮約する。
- `session/` は `<Game>Problem` に依存し、生成・診断専用情報を保持する型へ依存しない。

## 難易度

- 問題の特徴量を求める処理と、その特徴量を `easy` / `normal` / `hard` 等へ分類する方針を分離する。
- 問題の特徴量は `problem/difficulty-analysis.ts`、ゲームとしての分類方針は `difficulty.ts` が所有する。
- 問題選択は `problem-selection.ts` が `problem/` と `difficulty.ts` を組み合わせて行う。

## プレイ評価

- `session/` は経過時間、手数、ミス、操作回数など評価元の事実を返す。
- `score.ts` はその事実から現在の評価規則に従って評価を導出する。
- スコアから称賛段階などの意味的な評価段階を決める判断はゲーム側の評価責務に置き、UIコンポーネント内へ持ち込まない。
- 色、文言、演出など評価段階の視覚表現はUIが担当する。

## 依存方向

- `puzzle/` は同一ゲームの上位責務へ依存しない。
- `problem/` は `puzzle/` とゲーム非依存の共有コードへ依存できる。
- `session/` は `problem/` と `puzzle/` へ依存できる。
- `difficulty.ts` は問題の解析契約へ依存できる。
- `problem-selection.ts` は問題供給と `difficulty.ts` へ依存できる。
- `score.ts` は評価に必要な事実の契約へ依存できるが、`session/` の更新処理や `play/`、`ui/` へ依存しない。
- `play/` は `puzzle/`、`problem/`、`session/`、`difficulty.ts`、`score.ts`、`problem-selection.ts` へ依存できる。
- `ui/` は `play/` と表示に必要な読み取り専用の型・意味契約へ依存できる。
- `play-record.ts` と `diagnostics.ts` は接続対象となる共通機能と必要なゲーム内部契約へ依存できるが、通常プレイから逆依存させない。
- 循環依存を作らない。依存方向を守れない場合は例外を追加する前に責務の配置を見直す。

## トップレベル責務

- ゲーム直下には、`difficulty`、`score`、`problem-selection`、`play-record`、`diagnostics` のように複数の内側責務を調停するゲームレベルの責務を置く。
- ゲーム直下を「どこにも属さないもの」の置き場にしない。役割を具体的に命名できないファイルを追加しない。
- 同じ横断責務が複数ゲームに現れたら、ゲームごとに別名・別位置へ置かず、同じ責務名と標準位置を使う。
- 1責務が複数ファイルへ成長した場合は、責務名を保った同名ディレクトリへ分割する。
