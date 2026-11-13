---
paths:
  - "frontend/src/**/*.{ts,tsx}"
---

# 動き

- 共通UIの時間とイージングは `@theme` の動きのトークンから取る。Tailwind では `duration-(--duration-*)` と `ease-*`、TS（Web Animations API）では `@/lib/motion` の `MOTION_DURATION_MS` と `MOTION_EASING` を使う。
- ゲームの演出・結果画面の演出・図鑑の変化の演出・図鑑からプレイへ入る演出・画面の行き来の演出の時間・イージングは、トークンかその演出の名前付き定数にする。トークンに合わせるために演出の値を変えない。
- 画面の行き来の動きの種類は `@/lib/screen-transition` の `screenTransitionKind` で、行き来する画面の組から決める。
- 画面の行き来は `@/lib/screen-transition` の `runScreenTransition` から動かす。
- 画面の行き来で画面とは別に運ぶものの動きは `ScreenTransitionCarrier` で渡す。
- 行き来した先の画面が開いたときに始める、いくつもの変化をまとめて見せる演出は、`@/lib/screen-transition` の `afterScreenTransition` で、行き来の動きが終わってから始める。
- 動きを減らす設定は `@/lib/motion` の `prefersReducedMotion` で判定し、TS から動かす演出はその設定で動かさない。描いている間に設定が変わったら見た目を切り替える画面は、`subscribePrefersReducedMotion` で設定の変化に追従する。
- 操作が通らなかったことを返す揺れは `@/lib/motion` の `playRejectionShake` で再生する。揺れ方・長さ・イージングはゲームが渡す。

## 適用除外

- `frontend/src/components/ui/**` には当てない。
