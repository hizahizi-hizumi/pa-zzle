---
paths:
  - "frontend/src/games/**/*"
  - "!frontend/src/games/*/problem/problem-pool{,-index}.json"
  - "!frontend/src/games/*/problem/generation/*-reference.json"
---

# ゲームの構造

## 標準配置

- ゲーム固有の同じ責務は同じ名前・同じ位置に置く

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
  ├── tutorial/
  │   └── tutorial.ts
  ├── ui/
  │   ├── <Game>Play.tsx
  │   ├── <Game>HowToPlayDialog.tsx
  │   ├── <Game>Tutorial.tsx
  │   ├── <Game>Diagnostics.tsx
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
- `ui/<Game>HowToPlayDialog.tsx`: 遊び方の説明を置く
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
- `problem/difficulty-analysis.ts`: 問題から難易度判定用の特徴を導出するゲームに置く
- `problem/generation/`: 問題生成・検証の中でだけ使う解探索や手筋解析を持つゲームに置く
- `diagnostics.ts`・`ui/<Game>Diagnostics.tsx`: ゲーム固有の内部診断を提供するゲームに置く
- `assets/`: ゲーム固有の静的資産を持つゲームに置く
- `tutorial/`・`ui/<Game>Tutorial.tsx`: チュートリアルを提供するゲームに置く

## 評価段階の表示

- 評価段階の色・文言・演出は `ui/` に置く

## ゲーム共通の契約

- 複数ゲームで同じ意味を持つ契約は `frontend/src/games/` 直下に置く
- `frontend/src/games/` 直下の共通モジュールは、ゲームごとに変わる値（ゲーム名・文言・色・音など）をゲームから受け取る

## 表示名

- `frontend/src/games/` の中では、ゲーム名を `<GAME>_DISPLAY_NAME` で参照する
- `frontend/src/games/` の中では、難易度の表示名を `games/difficulty.ts` の `getDifficultyLabel` で得る

## 依存方向

- `ui/` から `problem/` を参照するときは、`problem/generation/` の外のファイルだけを参照する
- `score.ts` は、同じゲームの `problem/`・`puzzle/` と `games/score.ts` にだけ依存する
- `play-record.ts`・`play-attempt.ts`・`diagnostics.ts` をゲームの中で参照するのは、`ui/play-record-display.ts`・`ui/<Game>Diagnostics.tsx` とテストだけにする

## ゲーム直下

- ゲーム直下には標準配置に挙げたファイルとそのテストだけを置く
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
- プレイ画面・結果画面・クリア演出・チュートリアルを書くときは `.claude/rules/game-play-screen.md` を読む
- 効果音を書くときは `.claude/rules/game-sound.md` を読む
- ゲームを追加するときは、作り始める前に `.claude/rules/game-catalog.md` の「ゲームを追加するとき」を読む
