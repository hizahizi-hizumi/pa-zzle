---
paths:
  - "frontend/src/games/**/*.{ts,tsx}"
---

# ゲーム実装の標準構造

## 標準配置

同じ責務はゲームが違っても同じ名前・同じ位置に置く。責務が存在しない要素を形だけ揃えるために作らない。

```text
frontend/src/games/
├── result.ts
└── <game>/
    ├── puzzle/
    ├── problem/
    │   ├── problem.ts
    │   ├── generator.ts
    │   ├── difficulty-analysis.ts
    │   └── generation/
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

## 原則必須の責務

- `puzzle/`: パズルの状態、ルール、合法手、状態遷移を置く。
- `problem/problem.ts`: 1問を実際に遊ぶためのデータ契約を置く。
- `session/session.ts`: 1問に対する1回のプレイ状態、操作、経過事実を置く。
- `play/`: 問題供給、session、評価を組み合わせ、UIへプレイ状態と操作を提供する。
- `ui/`: ゲーム固有の表示とユーザー操作を扱う。
- `difficulty.ts`: ゲームとしての難易度ラベルと分類方針を置く。
- `score.ts`: 完了したプレイの事実をゲーム固有の評価へ変換する。
- `problem-selection.ts`: 開始条件に合う問題を問題供給元と難易度方針から選ぶ。
- `play-record.ts`: ゲーム固有の完了事実を共通記録機能へ接続する。

これらを省略するのは、`APP.md` / `GAME.md` 上、そのゲームだけ当該体験を持たないと説明できる場合に限る。

## 条件付きの責務

- `problem/generator.ts`: 実行時に問題を生成するゲームに置く。固定問題集や外部問題を選ぶだけなら置かない。
- `problem/difficulty-analysis.ts`: 問題から難易度判定用の特徴を導出するゲームに置く。難易度が問題データの既知情報なら置かない。
- `problem/generation/`: 問題生成・検証の内部でだけ使う解探索、手筋解析などを置く。通常プレイから直接参照しない。
- `diagnostics.ts`: ゲーム固有の内部診断を提供する場合に置く。
- `assets/`: ゲーム固有の静的資産がある場合に置く。

## 問題契約

- `<Game>Problem` は、その1問を遊ぶために必要な情報だけを持つ。
- seed、生成器の版、生成条件、生成試行回数など再現用情報は `<Game>ProblemIdentity` として分離する。
- 生成結果は `<Game>GeneratedProblem` として、`problem`、`identity`、問題解析結果、下流で必要な派生情報をまとめてよい。
- 解探索の手順や探索履歴は生成内部に閉じる。下流で必要なら `optimalMoveCount` のような意味のある派生値へ縮約する。
- `session/` は `<Game>Problem` に依存し、生成・診断専用情報を保持しない。

## 難易度

- 問題の特徴を求める処理と、その特徴を `easy` / `normal` / `hard` 等へ分類するゲーム方針を分離する。
- 特徴の解析は `problem/difficulty-analysis.ts`、分類方針は `difficulty.ts` が所有する。
- `problem-selection.ts` が問題供給と `difficulty.ts` を組み合わせて、要求難易度に合う問題を選ぶ。

## プレイ評価

- `session/` は経過時間、手数、ミス、操作回数など評価元の事実を返す。
- `score.ts` はその事実からゲーム固有の評価を導出する。
- スコアから称賛段階などの意味的な評価段階を決める処理もゲーム側に置く。
- 色、文言、演出など評価段階の視覚表現はUIが担当する。
- 複数ゲームで同じ意味を持つ契約は `frontend/src/games/` 直下へ置く。例: `result.ts` の `GameResultLevel`。

## 依存方向

- `puzzle/` は `problem/`、`session/`、`play/`、`ui/` を知らない。
- `problem/` は `puzzle/` とゲーム共通契約へ依存できるが、`session/`、`play/`、`ui/` を知らない。
- `problem/generation/` は問題生成・検証から使われ、通常プレイから直接参照されない。
- `session/` は `problem/` と `puzzle/` へ依存できるが、難易度分類、採点、保存、React、UIを知らない。
- `difficulty.ts` は問題解析結果へ依存できる。
- `problem-selection.ts` は問題供給と `difficulty.ts` へ依存できる。
- `score.ts` は評価に必要な事実の契約とゲーム共通契約へ依存できるが、`play/`、`ui/` を知らない。
- `play/` は下位のゲーム責務を調停するが、`ui/` を import しない。
- `ui/` は `play/` と表示に必要な読み取り専用の契約へ依存できる。問題生成、session更新、採点規則を実装しない。
- `play-record.ts` と `diagnostics.ts` は接続先と必要なゲーム内部契約へ依存できるが、通常プレイから逆依存させない。
- 別ゲームの実装を直接 import しない。
- 循環依存を作らない。例外を追加する前に責務の配置を見直す。

## ゲーム直下

- ゲーム直下には `difficulty`、`score`、`problem-selection`、`play-record`、`diagnostics` のようなゲーム全体の責務だけを置く。
- `hooks`、`services`、`utils`、`manager`、`game` のような実装方式・汎用箱で責務を分類しない。
- 同じ横断責務が複数ゲームに現れたら、同じ責務名と標準位置を使う。
- 1責務が複数ファイルへ成長した場合は、責務名を保った同名ディレクトリへ分割する。
