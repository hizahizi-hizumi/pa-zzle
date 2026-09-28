import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import type { ReflectionOutcome } from "@/games/reflection/puzzle/laser";

/**
 * リフレクション固有の色。共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * - `selection`: 選んでいるピース・ストックの種類・戻し先。
 * - `laser`: 光路と、光路を表示している外周ヒント。線や記号は `laserText`、外周ヒントの数字は
 *   白地でも文字として読める濃さの `laserLabel`、外周ヒントの枠は `laserRing` を使う。
 * - `clueMatch`: 今の配置での光が外周ヒントの数字・行き先と一致している外周ヒントの地と数字。
 *   ゲームの中の状態を示す色で、アプリ共通の `success`（クリア・完了）とは分ける。押せる外周ヒントに付けるので、
 *   ホバー・押下・フォーカスでも一致の色を保つ。
 */
export const reflectionToneClassNames = {
  selectionText: "text-sky-700 dark:text-sky-300",
  selectionSurface:
    "bg-sky-500/15 ring-2 ring-sky-600 ring-inset dark:bg-sky-400/15 dark:ring-sky-400",
  selectionBorder: "border-sky-600 dark:border-sky-400",
  laserText: "text-orange-600 dark:text-amber-400",
  laserLabel: "text-orange-700 dark:text-amber-400",
  laserSurface: "bg-orange-500/15 dark:bg-amber-400/15",
  laserRing: "ring-2 ring-orange-600 ring-inset dark:ring-amber-400",
  clueMatchSurface:
    "bg-emerald-200 focus-visible:bg-emerald-300/60 enabled:hover:bg-emerald-300/60 enabled:active:bg-emerald-300/60 dark:bg-emerald-900 dark:focus-visible:bg-emerald-800/70 dark:enabled:hover:bg-emerald-800/70 dark:enabled:active:bg-emerald-800/70",
  clueMatchLabel: "text-emerald-900 dark:text-emerald-100",
} as const;

/**
 * 外周ヒントの結果の色。形（斜めの矢印・折り返す矢印・塗りの点）と組にして使い、色だけで区別させない。
 * 白地・一致の地のどちらの上でも、図形として 3:1 以上の濃さにする。
 */
export const reflectionOutcomeToneClassNames = {
  exit: "text-blue-600 dark:text-blue-400",
  reflect: "text-pink-600 dark:text-pink-400",
  absorb: "text-violet-600 dark:text-violet-400",
} as const satisfies Record<ReflectionOutcome, string>;

/**
 * ピースの色。斜め鏡・両面鏡の4種は同じ色にして形で見分ける。当たった光を必ずはね返す反射体は「反射」、
 * 必ず吸い込むブラックホールは「吸収」と同じ色にして、外周ヒントの行き先とつながるようにする。
 */
export const reflectionPieceToneClassNames = {
  slash: "text-teal-700 dark:text-teal-300",
  backslash: "text-teal-700 dark:text-teal-300",
  "vertical-double": "text-teal-700 dark:text-teal-300",
  "horizontal-double": "text-teal-700 dark:text-teal-300",
  reflector: reflectionOutcomeToneClassNames.reflect,
  "black-hole": reflectionOutcomeToneClassNames.absorb,
} as const satisfies Record<ReflectionPiece, string>;
