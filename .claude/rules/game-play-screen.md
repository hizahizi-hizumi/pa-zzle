---
paths:
  - "frontend/src/games/*/ui/**/*.tsx"
  - "frontend/src/games/*/ui/**/{*-animations,*clear*,*cue*}.ts"
  - "frontend/src/games/*/ui/result/**/*.ts"
  - "frontend/src/games/*/tutorial/**/*.ts"
  - "!frontend/src/games/*/ui/*Diagnostics.tsx"
  - "!frontend/src/games/*/ui/*HowToPlayDialog/**"
  - "!frontend/src/games/*/ui/**/*sound*.ts"
  - "!**/*.test.{ts,tsx}"
---

# プレイ画面・結果画面・クリア演出・チュートリアル

## プレイ画面と結果画面の共通契約

- `ui/<Game>Play.tsx` の props は `games/play.ts` の `GamePlayScreenProps<Difficulty, Result>` で作る
- プレイ画面は `components/GamePlayFrame.tsx` の `background` にゲーム固有の地を、`children` に盤面の `main` とゲーム固有の操作の `footer` を渡して作る
- 見出しの計測値は `components/play-header-metric.ts` の `PlayHeaderMetric` で渡す
- 盤面は操作を受け付けないことを `interactionDisabled` で受け取る
- `canUndo`・`canRestart` は、プレイフックが返す値をそのまま使う
- 操作の callback props は、タップ・キーボードなどの入力手段ではなく操作の意味で名付ける

  ```
  OK:
  onRevealCell
  NG:
  onCellTap
  ```

- 操作（待った・盤面を戻す・リセット・別の問題）と評価項目の呼び名は `games/play-vocabulary.ts` の値を使う

- `ui/result/<Game>ResultScreen.tsx` の props は `games/play.ts` の `GamePlayResultScreenProps<Difficulty, Result>` で作る
- 結果画面の指標は `components/game-result-metrics.ts` で組み立てる
- 採点基準の文は `components/game-result-score-criteria.ts` で組み立てる
- 採点基準の文は常体で書く
- 丸めの注記は `components/GameResultScreen.tsx` に任せる

## クリア演出

- クリア演出は `lib/motion.ts` の `playAnimations` で再生する
- 演出の完了を受け取る盤面の props は `onClearAnimationComplete` にする
- `ui/<Game>Play.tsx` は `GamePlayScreenProps` の `onClearAnimationComplete` を盤面へ渡す
- 演出の層はプレイ画面の中に描く
- 演出の層の重なり順を決めるときは `DESIGN.md` の「奥行き」を読む

## チュートリアル

- `tutorial/tutorial.ts` に、`games/tutorial.ts` の `Tutorial` を満たす `<game>Tutorial` を置く

  ```
  OK:
  slidePuzzleTutorial
  ```

- チュートリアルの盤面は `puzzle/` の遷移で進める
- 本番と同じ盤面の反応と見え方が要るときは、`session/` の関数で盤面の反応と見え方だけを求める
- `ui/<Game>Tutorial.tsx` は、`<game>Tutorial` を `games/tutorial.ts` の進行関数で進めて `components/TutorialOverlay.tsx` に渡す
- チュートリアルの盤面操作の音とクリア音は、プレイ画面と同じゲームの効果音のフックで鳴らす
- チュートリアルを解き終えたら本番と同じクリア演出を見せる
- チュートリアルのクリア演出の完了で `completeTutorial` を呼ぶ
- チュートリアルの印と合図は `components/TutorialCue.tsx` だけで描く
- チュートリアルで覆いから抜く所は `components/TutorialSpotlight.tsx` だけで描く
- 盤面部品は印・合図・抜く所を任意の props で受け取り、受け取らないときは本番と同じに描く
- チュートリアルの画面は、プレイ中のメニューへ `ui/<Game>Play.tsx` から `GamePlayFrame` の `renderTutorial` で渡す
