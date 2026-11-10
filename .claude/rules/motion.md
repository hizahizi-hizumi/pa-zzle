---
paths:
  - "frontend/src/components/**/*.{ts,tsx}"
  - "frontend/src/games/*/ui/**/*.{ts,tsx,css}"
  - "frontend/src/games/play-sound-effects.ts"
  - "frontend/src/records/ui/**/*.{ts,tsx}"
  - "frontend/src/zukan/ui/**/*.{ts,tsx}"
  - "frontend/src/views/**/*.{ts,tsx}"
  - "frontend/src/lib/motion.ts"
  - "!frontend/src/components/ui/**/*"
  - "!**/*.test.{ts,tsx}"
---

# 動き

## 時間とイージング

- 共通UIの時間とイージングは、`frontend/styles/globals.css` の `@theme` の動きのトークンから取る
- Tailwind では、時間を `duration-(--duration-*)`、イージングを `ease-*` で指定する
- Web Animations API では、時間を `@/lib/motion` の `MOTION_DURATION_MS`、イージングを `MOTION_EASING` から取る
- ゲームの演出・結果画面の演出・図鑑の変化の演出の時間とイージングは、トークンかその演出の名前付き定数にする
- トークンと値が合わない演出は、演出の値のまま名前付き定数にする

## 動きを減らす設定

- 動きを減らす設定は、`@/lib/motion` の `prefersReducedMotion` で判定する
- 動きを減らす設定では、TS から動かす演出を動かさない
- 動きを減らす設定では、クリア演出を動かさない
- 描いている間に設定が変わったら見た目を切り替える画面は、`@/lib/motion` の `subscribePrefersReducedMotion` で設定の変化に追従する

## 操作が通らなかったときの揺れ

- 操作が通らなかったことを返す揺れは、`@/lib/motion` の `playRejectionShake` で再生する
- 揺れ方・長さ・イージングは、ゲームが `playRejectionShake` に渡す
