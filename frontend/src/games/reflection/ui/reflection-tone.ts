import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import type { ReflectionOutcome } from "@/games/reflection/puzzle/laser";

/**
 * リフレクション固有の色。共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * - `selection`: 選んでいるピース・ストックの種類・戻し先。無彩色にして、ピースや外周ヒントの結果の色と取り違えないようにする。
 * - `laser`: 光路と、光路を表示している外周ヒント。線や記号は `laserText`、外周ヒントの数字は
 *   白地でも文字として読める濃さの `laserLabel`、外周ヒントの枠は `laserRing` を使う。
 * - `laserBadge`: 光路を表示している外周ヒントに添える、今の光の通るマスの数と結果の札。
 * - `laserExit`: 表示中の光が出た先の外周ヒントの破線の枠。
 * - `clueMatch`: 今の配置での光が外周ヒントの数字・行き先と一致している外周ヒントの地と数字。
 *   控えめな緑の地にし、一致の切り替えでは地と数字の色だけを瞬時に変える（大きさ・位置・枠・太さは変えない）。
 *   押せる外周ヒントに付けるので、ホバー・押下・フォーカスでも一致の色を保つ。
 *   ゲームの中の状態を示す色で、アプリ共通の `success`（クリア・完了）とは分ける。
 */
export const reflectionToneClassNames = {
  selectionText: "text-foreground",
  selectionSurface: "bg-foreground/10 ring-2 ring-foreground ring-inset",
  selectionBorder: "border-foreground",
  laserText: "text-orange-600 dark:text-amber-400",
  laserLabel: "text-orange-700 dark:text-amber-400",
  laserSurface: "bg-orange-500/15 dark:bg-amber-400/15",
  laserRing: "ring-2 ring-orange-600 ring-inset dark:ring-amber-400",
  laserBadge:
    "bg-orange-700 text-white dark:bg-amber-400 dark:text-neutral-950",
  laserExit:
    "outline-2 outline-dashed -outline-offset-2 outline-orange-600 dark:outline-amber-400",
  clueMatchSurface:
    "bg-emerald-100 focus-visible:bg-emerald-200 enabled:hover:bg-emerald-200 enabled:active:bg-emerald-200 dark:bg-emerald-950 dark:focus-visible:bg-emerald-900 dark:enabled:hover:bg-emerald-900 dark:enabled:active:bg-emerald-900",
  clueMatchLabel: "text-emerald-900 dark:text-emerald-200",
} as const;

/**
 * 外周ヒントの結果の色。形（斜めの矢印・折り返す矢印・塗りの点）と組にして使い、色だけで区別させない。
 * 盤面の地・一致の地のどちらの上でも、図形として 3:1 以上の濃さにする。
 */
export const reflectionOutcomeToneClassNames = {
  exit: "text-blue-600 dark:text-blue-400",
  reflect: "text-pink-600 dark:text-pink-400",
  absorb: "text-violet-600 dark:text-violet-400",
} as const satisfies Record<ReflectionOutcome, string>;

/**
 * ピースの色。そのピースが生む外周ヒントの結果の色にそろえる。光を曲げて外へ導く斜め鏡・両面鏡の4種は「退出」、
 * 当たった光を必ずはね返す反射体は「反射」、必ず吸い込むブラックホールは「吸収」と同じ色にする。鏡4種は形で見分ける。
 */
export const reflectionPieceToneClassNames = {
  slash: reflectionOutcomeToneClassNames.exit,
  backslash: reflectionOutcomeToneClassNames.exit,
  "vertical-double": reflectionOutcomeToneClassNames.exit,
  "horizontal-double": reflectionOutcomeToneClassNames.exit,
  reflector: reflectionOutcomeToneClassNames.reflect,
  "black-hole": reflectionOutcomeToneClassNames.absorb,
} as const satisfies Record<ReflectionPiece, string>;
