/**
 * 違反の印を出すまで待つ時間。巡回で B へ進む途中の A が一瞬だけ違反になっても印がちらつかないよう、出すときだけ待つ。
 * 240ms は、同じマスを続けて押す間隔（120〜200ms）より長く、手を止めればすぐ見える長さ。消すときは待たない。
 * 印に添える言葉（遊び方の判定など）も、この時間だけ待って替える。
 */
export const VIOLATION_MARK_DELAY_MS = 240;

/**
 * 違反の印の出し方。印を持つ要素の祖先（`group`）に `data-violated` を置くと、`VIOLATION_MARK_DELAY_MS` 待ってから出る。
 * Tailwind がクラス名を静的に読めるよう、待つ時間をクラス名に直に書く。
 */
export const violationMarkTimingClassName =
  "opacity-0 transition-opacity duration-0 group-data-violated:opacity-100 group-data-violated:delay-[240ms] group-data-violated:duration-(--duration-normal) motion-reduce:group-data-violated:duration-0";
