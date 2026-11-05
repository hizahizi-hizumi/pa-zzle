---
paths:
  - "frontend/src/games/*/ui/**/*.{ts,tsx}"
  - "!frontend/src/games/*/ui/{play-record-display,problem-features}{,.test}.ts"
  - "!frontend/src/games/*/ui/*Diagnostics{,.test}.tsx"
  - "frontend/src/games/*/assets/**/*.{flac,mp3,ogg,wav,m4a}"
---

# プレイ画面と演出

## プレイ画面

- `ui/<Game>Play.tsx` の props は `games/play.ts` の `GamePlayScreenProps<Difficulty, Result>` に次を足して作る
  - 盤面を戻せるなら `RestartableGamePlayScreenProps`
  - 待ったがあるなら `UndoableGamePlayScreenProps`
  - ゲーム固有の値・操作
- 難易度は値で受け取り、表示名は `games/difficulty.ts` の `getDifficultyLabel` で得る
- プレイ画面は `components/GamePlayFrame.tsx` に盤面（`main`）とゲーム固有の操作（`footer`）を渡して作る
- 外枠・ブランドの帯・見出し・遊び方の開閉・結果画面への切り替えは `GamePlayFrame` に任せる
- 見出しの計測値は `PlayHeaderMetric` の回数（`count`）と経過時間（`elapsed-time`）で渡す
- 見出しの計測値の書式と行の分け方は `GamePlayFrame` に任せる
- プレイで変わらない問題そのものの条件（詰将棋の「5手詰」など）は `problem-fact` の文言で渡す
- 回数の桁の確保は共通部品の既定に任せ、変えるときだけ `reservedDigits` で渡す
- 盤面は `progress` が `playing` の間だけ操作を受け付け、受け付けないことを `interactionDisabled` で受け取る
- UI は `canUndo`・`canRestart` を組み合わせて作り直さず、`<Game>Play` の値をそのまま使う
- 操作の callback props は、タップ・キーボードなどの入力手段ではなく操作の意味で名付ける

  ```
  OK:
  onRevealCell
  NG:
  onCellTap
  ```

- 操作（待った・盤面を戻す・リセット・別の問題）と評価項目の呼び名は `games/play-vocabulary.ts` の値を使う

## 結果画面

- `ui/result/<Game>ResultScreen.tsx` の props は `games/play.ts` の `GamePlayResultScreenProps<Difficulty, Result>` で作る
- 結果画面の指標は `components/game-result-metrics.ts` で組み立てる
- 採点基準の文は `components/game-result-score-criteria.ts` で組み立てる
- 指標の数には単位を付ける
- 採点基準の文は常体で書く
- 丸めの注記は共通の結果画面に任せる

## クリア演出

- クリア演出は `@/lib/motion` の `playAnimations` で再生する
- 演出の中身と長さ、完了の決め方（`completion`）、動きを減らす設定と動かせない環境で完了するまでの時間（`reducedMotionHoldMs`・`unanimatedHoldMs`）はゲームが渡す
- 演出の完了を受け取る盤面の props は `onClearAnimationComplete` にする
- `ui/<Game>Play.tsx` は `GamePlayScreenProps` の `onClearAnimationComplete` を盤面へ渡す
- 演出の層は `document.body` へ portal せず、プレイ画面の中に描く
- 演出の層の重なり順は、プレイ画面の中の値で表す

## 効果音

- ゲームの効果音は、題材から作った音声ファイルを `assets/` に置く
- ゲームの音声ファイルは FLAC にする
- 効果音は `assets/` の音声ファイルを `@/lib/sound-effects` の `playSound` で鳴らす
- 回数の多い操作の音には `REPEATED_SOUND_VARIATION` を渡す
- 盤面操作の音は、プレイ画面が `games/play-sound-effects.ts` の `useOperationSound` で操作の知らせから鳴らす
- クリア音は `useClearSound` で完成演出の始まりに鳴らす
- 動きを減らす設定では、不成立の動きが出ず画面が何も変わらない操作の音を鳴らさない
- 動きを減らす設定で完成演出が無くすぐ結果へ進むときは、クリア音を鳴らさない
- 完成した盤面を保持して見せるゲームは、動きを減らす設定でも、その姿に合わせたクリア音を `useClearSound` へ渡す
- 結果を受け取る瞬間の報酬の音は `usePlayableGame` に任せる
- ゲームを選ぶ・プレイを始める決定音は、`@/components/app-decision-sound` を使うアプリの共通部品に任せる
- BGM は、プレイ中の曲も含めて、アプリが `@/components/app-background-music` で画面ごとに流すものに任せる
