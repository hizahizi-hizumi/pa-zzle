import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import type { ReflectionOutcome } from "@/games/reflection/puzzle/laser";

/**
 * リフレクション固有の色。共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * - 選んでいるピース・ストックの種類は、地や枠を変えず、ピースの色の印で示す（盤面のマスは四隅の鉤形、ストックは下の短い線。
 *   `reflectionPieceBarClassNames`）。2026-09-29 の人間判断で、無彩色の地と太枠をやめた。
 * - `returnTarget`: 盤面のピースを選んでいる間の戻し先（ストック）。枠で囲まず、地の色の差だけで示す。
 * - `laser`: 光路と、光路を表示している外周ヒント。線や記号は `laserText`、外周ヒントに添える今の光の通るマスの数は、
 *   白地でも文字として読める濃さの `laserLabel` を使う。外周ヒントには枠や地を足さない。
 * - `clueMatch`: 今の配置での光が外周ヒントの数字・行き先と一致している外周ヒントの地と数字。
 *   外周ヒントの内側に余白を残した控えめな緑の地にし、隣り合う一致の地が帯としてつながらないようにする。
 *   一致の切り替えでは地と数字の色だけを瞬時に変える（大きさ・位置・枠・太さは変えない）。
 *   押せる外周ヒントでは、ホバー・押下・フォーカスで一致の地を一段濃くする（`clueMatchSurfaceInteractive`、外周ヒントのボタンを `group` にする）。
 *   ゲームの中の状態を示す色で、アプリ共通の `success`（クリア・完了）とは分ける。
 */
export const reflectionToneClassNames = {
  returnTargetSurface: "bg-foreground/7",
  laserText: "text-orange-600 dark:text-amber-400",
  laserLabel: "text-orange-700 dark:text-amber-400",
  clueMatchSurface: "bg-emerald-100 dark:bg-emerald-950",
  clueMatchSurfaceInteractive:
    "group-focus-visible:bg-emerald-200 group-enabled:group-hover:bg-emerald-200 group-enabled:group-active:bg-emerald-200 dark:group-focus-visible:bg-emerald-900 dark:group-enabled:group-hover:bg-emerald-900 dark:group-enabled:group-active:bg-emerald-900",
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

const outcomeBarClassNames = {
  exit: "bg-blue-600 dark:bg-blue-400",
  reflect: "bg-pink-600 dark:bg-pink-400",
  absorb: "bg-violet-600 dark:bg-violet-400",
} as const satisfies Record<ReflectionOutcome, string>;

/**
 * ピースの色。そのピースの働きを外周ヒントの結果の色にそろえる（2026-09-29 の人間判断で両面鏡を「反射」へ変更）。
 * 光を直角に曲げて外へ導く斜め鏡2種は「退出」、正面から当たった光をはね返す両面鏡2種と、当たった光を必ずはね返す
 * 反射体は「反射」、必ず吸い込むブラックホールは「吸収」と同じ色にする。同じ色のピースは形で見分ける。
 */
export const reflectionPieceToneClassNames = {
  slash: reflectionOutcomeToneClassNames.exit,
  backslash: reflectionOutcomeToneClassNames.exit,
  "vertical-double": reflectionOutcomeToneClassNames.reflect,
  "horizontal-double": reflectionOutcomeToneClassNames.reflect,
  reflector: reflectionOutcomeToneClassNames.reflect,
  "black-hole": reflectionOutcomeToneClassNames.absorb,
} as const satisfies Record<ReflectionPiece, string>;

/** ストックで選んでいる種類の下に引く短い線の色。ピースの色と同じ色相の塗り。 */
export const reflectionPieceBarClassNames = {
  slash: outcomeBarClassNames.exit,
  backslash: outcomeBarClassNames.exit,
  "vertical-double": outcomeBarClassNames.reflect,
  "horizontal-double": outcomeBarClassNames.reflect,
  reflector: outcomeBarClassNames.reflect,
  "black-hole": outcomeBarClassNames.absorb,
} as const satisfies Record<ReflectionPiece, string>;
