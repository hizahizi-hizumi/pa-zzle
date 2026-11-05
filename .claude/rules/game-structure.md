---
paths:
  - "frontend/src/games/**/*"
---

# ゲームの構造

## 標準配置

- ゲーム固有の同じ責務は、ゲームが違っても同じ名前・同じ位置に置く

  ```text
  OK:
  frontend/src/games/<game>/
  ├── puzzle/
  ├── problem/
  │   ├── problem.ts
  │   ├── problem-pool.ts
  │   ├── generator.ts
  │   ├── difficulty-analysis.ts
  │   └── generation/
  ├── session/
  │   └── session.ts
  ├── play/
  │   └── use-<game>-play.ts
  ├── ui/
  │   ├── <Game>Play.tsx
  │   ├── play-record-display.ts
  │   ├── problem-features.ts
  │   └── result/
  │       └── <Game>ResultScreen.tsx
  ├── assets/
  ├── display-name.ts
  ├── difficulty.ts
  ├── score.ts
  ├── problem-selection.ts
  ├── play-record.ts
  ├── play-attempt.ts
  └── diagnostics.ts
  ```

## 原則必須の責務

- `puzzle/`: パズルの状態、ルール、合法手、状態遷移を置く
- `problem/problem.ts`: 1問を遊ぶためのデータ契約を置く
- `session/session.ts`: 1問に対する1回のプレイの状態、操作、経過事実を置く
- `play/`: 問題供給、session、評価を組み合わせ、UI へプレイ状態と操作を渡す
- `ui/`: ゲーム固有の表示とユーザー操作を置く
- `ui/result/`: 結果画面を置く
- `ui/play-record-display.ts`: 記録表示を置く
- `ui/problem-features.ts`: 図鑑に渡す問題の特徴の名前と値の書き方を置く
- `display-name.ts`: 利用者に見せるゲーム名 `<GAME>_DISPLAY_NAME` を置く
- `difficulty.ts`: 問題の特徴を難易度のレベルへ分類する方針を置く
- `score.ts`: 完了したプレイの事実をゲーム固有の評価へ変換する
- `problem-selection.ts`: 問題供給と `difficulty.ts` を組み合わせて、開始条件に合う問題を選ぶ
- `play-record.ts`: ゲーム固有の完了事実を共通の記録機能へ接続する
- `play-attempt.ts`: 完了せずに離れたプレイの進み具合として記録する実測値を `session/` から選ぶ
- 原則必須の責務を省くのは、`docs/プロダクト/仕様/パズル/` の該当パズルの仕様にその体験が無いときだけにする

## 条件付きの責務

- `problem/generator.ts`: 実行時に問題を生成するゲームに置く
- `problem/problem-pool.ts`: 問題集から問題を復元するゲームに置く
- 図鑑に渡す問題の特徴（`<Game>ProblemFeatures` と、それを求める関数・軸）は、問題集の項目から求める派生情報として `problem/problem-pool.ts` に置く
- `problem/difficulty-analysis.ts`: 問題から難易度判定用の特徴を導出するゲームに置く
- `problem/generation/`: 問題生成・検証の中でだけ使う解探索や手筋解析を持つゲームに置く
- `diagnostics.ts`: ゲーム固有の内部診断を提供するゲームに置く
- `assets/`: ゲーム固有の静的資産を持つゲームに置く

## ゲーム層と UI の分担

- スコアから称賛段階などの評価段階を決める処理は、`ui/` ではなくゲーム層に置く
- 評価段階の色・文言・演出は `ui/` に置く
- 問題生成・session の更新・採点規則は `ui/` の外の `problem/`・`session/`・`score.ts` に置く

## ゲーム共通の契約

- 複数ゲームで同じ意味を持つ契約は `frontend/src/games/` 直下に置く
- 共通モジュールには仕組みだけを置き、ゲームの表現に属する値はゲームから受け取る

## ゲーム名

- `frontend/src/games/` の中では、ゲーム名を `<GAME>_DISPLAY_NAME` で参照する

## 依存方向

- 層の依存の規則を変えるときは `frontend/scripts/dependency-rules.ts` を直し、`bun run --cwd frontend generate:dependency-rules` で生成し直す
- `frontend/biome.json` の規則に加えて、次の依存方向を守る
  - `ui/` は `problem/generation/` を参照しない
  - `score.ts` は評価に必要な事実の契約とゲーム共通の契約へ依存し、`play/`・`ui/` を知らない
  - `ui/` は `play/` と表示に必要な読み取り専用の契約へ依存する
  - `play-record.ts`・`play-attempt.ts`・`diagnostics.ts` は、通常プレイ（`session/`・`play/`・盤面とプレイ画面の `ui/`）から参照しない

## ゲーム直下

- ゲーム直下には `display-name`、`difficulty`、`score`、`problem-selection`、`play-record`、`play-attempt`、`diagnostics` のようなゲーム全体の責務だけを置く
- ゲーム内のファイルとディレクトリは責務の名前で名付ける

  ```text
  OK:
  problem-selection.ts
  NG:
  utils/
  hooks/
  services/
  manager.ts
  game.ts
  ```

- 1つの責務が複数ファイルに育ったら、責務名と同じ名前のディレクトリに分ける

## ほかのルール

- 問題・難易度・記録・評価・session・play・診断の契約を書くときは `.claude/rules/game-contracts.md` を読む
- プレイ画面・結果画面・クリア演出・効果音を書くときは `.claude/rules/game-play-screen.md` を読む
- ゲームを追加するときは、作り始める前に `.claude/rules/game-catalog.md` の「ゲームを追加する手順」を読む
