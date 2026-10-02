---
paths:
  - "frontend/src/games/**/*.{ts,tsx}"
  - "frontend/src/game-catalog/**/*.{ts,tsx}"
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
    │   └── result/
    │       └── <Game>ResultScreen.tsx
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
- `ui/`: ゲーム固有の表示とユーザー操作を扱う。結果画面はプレイ画面と記録の結果画面の両方から使うので、プレイ画面の内部実装ではなく `ui/result/` に置く。
- `difficulty.ts`: ゲームとしての難易度ラベルと分類方針を置く。
- `score.ts`: 完了したプレイの事実をゲーム固有の評価へ変換する。
- `problem-selection.ts`: 開始条件に合う問題を問題供給元と難易度方針から選ぶ。
- `play-record.ts`: ゲーム固有の完了事実を共通記録機能へ接続する。今の版の記録から結果画面に出す内容を作り直す `restore<Game>RecordedResult` も置き、結果の計算は `play/` の `create<Game>Result` をプレイ中と共用する。

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

- 問題の特徴を求める処理と、その特徴を `1`〜`5` のレベル等へ分類するゲーム方針を分離する。
- 特徴の解析は `problem/difficulty-analysis.ts`、分類方針は `difficulty.ts` が所有する。
- `problem-selection.ts` が問題供給と `difficulty.ts` を組み合わせて、要求難易度に合う問題を選ぶ。

## プレイ評価

- `session/` は経過時間、手数、ミス、操作回数など評価元の事実を返す。
- `score.ts` はその事実からゲーム固有の評価を導出する。
- スコアから称賛段階などの意味的な評価段階を決める処理はゲーム層に置く。SPEC-006 の段階基準は全ゲーム共通なので `result.ts` の `getGameResultLevel` を使う。
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
- `ui/play-record-display.ts` は記録 UI の表示契約（`@/records/ui/play-record-display`）へ接続できる。記録表示は記録定義の全指標を網羅する。
- ゲームカタログ（`frontend/src/game-catalog/`）へ依存しない。
- 別ゲームの実装を直接 import しない。
- 循環依存を作らない。例外を追加する前に責務の配置を見直す。

## ゲーム直下

- ゲーム直下には `difficulty`、`score`、`problem-selection`、`play-record`、`diagnostics` のようなゲーム全体の責務だけを置く。
- `hooks`、`services`、`utils`、`manager`、`game` のような実装方式・汎用箱で責務を分類しない。
- 同じ横断責務が複数ゲームに現れたら、同じ責務名と標準位置を使う。
- 1責務が複数ファイルへ成長した場合は、責務名を保った同名ディレクトリへ分割する。

## ゲームカタログ

アプリがゲームをどう提供するかは、ゲームの外側の `frontend/src/game-catalog/` が持つ。

```text
frontend/src/game-catalog/
├── game-catalog-entry.ts
├── game-catalog.ts
├── problem-id-query.ts
├── play-location-state.ts
├── record-result-location-state.ts
├── record-result-navigation.ts
└── <game>/
    ├── <game>-catalog-entry.tsx
    ├── Playable<Game>.tsx
    └── Recorded<Game>Result.tsx
```

- `game-catalog-entry.ts`: 1ゲーム分のカタログ項目 `GameCatalogEntry` と、記録の問題を遊び直すプレイ画面・記録から描く結果画面（`RecordResultContext`）の契約を置く。
- `game-catalog.ts`: 全ゲームを表示順に並べた `gameCatalog` を置く。パズル選択・記録・結果の画面は、ゲームを列挙せずこれを回す。
- `problem-id-query.ts`: プレイ画面の URL の `problem` クエリ（問題 ID）の読み書きを置く。
- `play-location-state.ts`: プレイ画面へ渡す location state（最初に避ける問題の ID）の作成と読み取りを置く。
- `record-result-location-state.ts`: 結果画面へ渡す location state（記録の保存結果）の作成と、形を確かめた読み取りを置く。
- `record-result-navigation.ts`: クリアして記録を保存できたプレイを、記録の結果画面 `/puzzles/<game>/result/<記録ID>` へ履歴を置き換えて移す共通フックを置く。
- `<game>-catalog-entry.tsx`: ID（記録の `gameId`）、表示名、ピクトグラム、入口パス、プレイ画面のパス、記録表示、記録の問題を遊び直す難易度と問題 ID、記録から描く結果画面を持つ。遊び直し先は記録一覧の全行で求めるので、問題を復元せず問題集の索引で引けるかだけを確かめる。結果画面は今の版の記録からだけ描き、描けない記録には `null` を返す。
- `Playable<Game>.tsx`: `play/`・`ui/`・記録保存・診断・画面遷移を合成し、1問を遊べるプレイ画面にする。記録を保存できたクリアは記録の結果画面へ移し、その場の結果画面は記録を保存しないプレイと保存に失敗したプレイでだけ出す。
- `Recorded<Game>Result.tsx`: 記録から作り直した結果を `ui/result/<Game>ResultScreen.tsx` で描き、次の問題（記録と同じ難易度で記録の問題を避ける）と診断をつなぐ。

## ゲームを追加するとき

1. `games/<game>/` を標準配置で実装する。
2. `game-catalog/<game>/` に `Playable<Game>.tsx`、`Recorded<Game>Result.tsx`、`<game>-catalog-entry.tsx` を置き、`game-catalog.ts` の並びへ加える。
3. `pages/puzzles/<game>/` と、そのルートの View（難易度選択・プレイ）を置く。
4. `bun run --cwd frontend generate:dependency-rules` で `frontend/biome.json` の依存規則を生成し直す。規則は `src/games/` 直下のディレクトリから全ゲームに同じ形で作られ、生成結果との一致はテストで検査される。
