import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import type { ReflectionOutcome } from "@/games/reflection/puzzle/laser";

/**
 * リフレクション固有の色。共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * - `selection`: 選んでいるピース・ストックの種類・戻し先。無彩色にして、ピースや外周ヒントの結果の色と取り違えないようにする。
 * - `laser`: 光路と、光路を表示している外周ヒント。線や記号は `laserText`、外周ヒントの数字は
 *   白地でも文字として読める濃さの `laserLabel`、外周ヒントの枠は `laserRing` を使う。
 * - `clueMatch`: 今の配置での光が外周ヒントの数字・行き先と一致している外周ヒントの数字。
 *   地は塗らず数字の色だけを変え、置くたびに面が点いたり消えたりして盤面の周りが騒がしくならないようにする。
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
  clueMatchLabel: "text-emerald-700 dark:text-emerald-400",
} as const;

/**
 * 外周ヒントの結果の色。形（斜めの矢印・折り返す矢印・塗りの点）と組にして使い、色だけで区別させない。
 * 盤面の地の上で、図形として 3:1 以上の濃さにする。
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
