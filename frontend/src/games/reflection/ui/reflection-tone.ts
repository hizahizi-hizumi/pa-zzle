import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import type { ReflectionOutcome } from "@/games/reflection/puzzle/laser";

export const reflectionToneClassNames = {
  /**
   * 光路と、光路を表示している外周ヒント。線や記号は `laserText`、外周ヒントに添える今の光の通るマスの数は、
   * 白地でも文字として読める濃さの `laserLabel` を使う。外周ヒントには枠や地を足さない。
   */
  laserText: "text-orange-600 dark:text-amber-400",
  laserLabel: "text-orange-700 dark:text-amber-400",
  /**
   * 今の配置での光が外周ヒントの数字・行き先と一致している外周ヒントの地と数字。
   * 外周ヒントの内側に余白を残した控えめな緑の地にし、隣り合う一致の地が帯としてつながらないようにする。
   * 一致の切り替えでは地と数字の色だけを瞬時に変える（大きさ・位置・枠・太さは変えない）。
   */
  clueMatchSurface: "bg-emerald-100 dark:bg-emerald-950",
  /** 押せる外周ヒントでは、ホバー・押下・フォーカスで一致の地を一段濃くする（外周ヒントのボタンを `group` にする）。 */
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

/**
 * ストックで選んでいる種類の地と縁。ピースの色と同じ色相で、地は淡く、縁は図形として読める濃さにする。
 * 明るい地でも暗い地でも面として見えるよう、地と縁の明暗を分ける。
 */
const outcomeSelectionSurfaceClassNames = {
  exit: "bg-blue-100 ring-blue-600 dark:bg-blue-950 dark:ring-blue-400",
  reflect: "bg-pink-100 ring-pink-600 dark:bg-pink-950 dark:ring-pink-400",
  absorb:
    "bg-violet-100 ring-violet-600 dark:bg-violet-950 dark:ring-violet-400",
} as const satisfies Record<ReflectionOutcome, string>;

/** 盤面のピースを選んでいる間の戻し先（同じ種類のストック）の縁。選んでいる種類の縁を点線にして薄くする。 */
const outcomeReturnTargetClassNames = {
  exit: "border-blue-600/60 dark:border-blue-400/60",
  reflect: "border-pink-600/60 dark:border-pink-400/60",
  absorb: "border-violet-600/60 dark:border-violet-400/60",
} as const satisfies Record<ReflectionOutcome, string>;

/**
 * ピースの色。そのピースの働きを外周ヒントの結果の色にそろえる。
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

/**
 * ストックで選んでいる種類は、ピースの色の地と縁で面として囲み、ピースを少し大きくして示す。
 * 盤面のマスで選んでいるピースは、マスの四隅の鉤形で示す。
 * 盤面のピースを選んでいる間の戻し先（同じ種類のストック）は、点線の縁で示す（文字や帯は出さない）。
 */
export const reflectionPieceSelectionSurfaceClassNames = {
  slash: outcomeSelectionSurfaceClassNames.exit,
  backslash: outcomeSelectionSurfaceClassNames.exit,
  "vertical-double": outcomeSelectionSurfaceClassNames.reflect,
  "horizontal-double": outcomeSelectionSurfaceClassNames.reflect,
  reflector: outcomeSelectionSurfaceClassNames.reflect,
  "black-hole": outcomeSelectionSurfaceClassNames.absorb,
} as const satisfies Record<ReflectionPiece, string>;

export const reflectionPieceReturnTargetClassNames = {
  slash: outcomeReturnTargetClassNames.exit,
  backslash: outcomeReturnTargetClassNames.exit,
  "vertical-double": outcomeReturnTargetClassNames.reflect,
  "horizontal-double": outcomeReturnTargetClassNames.reflect,
  reflector: outcomeReturnTargetClassNames.reflect,
  "black-hole": outcomeReturnTargetClassNames.absorb,
} as const satisfies Record<ReflectionPiece, string>;
