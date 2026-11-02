/**
 * ハミルトン路固有の色。共通UIの意味色（`primary`・`success`・`error` など）は流用しない。
 * - 道は始点の青緑から、全マスを通り終える所の紫へ、通った順に色を移す。道が盤面を塗り進むほど色が変わり、
 *   蛇行して隣り合う道の列どうしも色の違いで追える。赤・橙はアプリ共通のエラー色と紛れるので使わない。
 * - 道が通ったマスは、そのマスを通ったときの道の色を淡く塗る。
 * - 壁マスと仕切りはどちらも「通れない」ことを示すので、ライトでは同じ系統の最も暗い色にする。
 *   ダークでは壁マスを盤面より暗い穴のままにし、仕切りは暗い地に埋もれないよう明るい棒にする。
 * - 行き止まりの先端は、道の色をやめて沈んだ無彩色にする。
 * 色の値は `pathColorVariables` の CSS 変数として盤面の根に置き、マスと道の色は `getPathColor` などで混ぜて作る。
 */
export const hamiltonianPathToneClassNames = {
  pathColorVariables:
    "[--hamiltonian-path-from:var(--color-cyan-600)] [--hamiltonian-path-to:var(--color-violet-600)] [--hamiltonian-path-cell:var(--color-white)] dark:[--hamiltonian-path-from:var(--color-cyan-400)] dark:[--hamiltonian-path-to:var(--color-violet-400)] dark:[--hamiltonian-path-cell:var(--color-stone-800)]",
  unvisitedCell: "fill-(--hamiltonian-path-cell)",
  wallCell: "fill-stone-800 dark:fill-stone-950",
  gridLine: "stroke-stone-300 dark:stroke-stone-600",
  partition: "fill-stone-800 dark:fill-stone-200",
  /** 始点の印の縁取り。道の上でも印として浮くよう、マスの地の色で囲む。 */
  startMarkOutline: "stroke-(--hamiltonian-path-cell)",
  deadEndHead: "stroke-stone-400 dark:stroke-stone-500",
  /** クリアしたとき、始点から終点へ道をなぞる光。 */
  clearTrace: "stroke-white/80 dark:stroke-white/70",
} as const;

/** 道が通ったマスの塗りに混ぜる、道の色の割合（%）。 */
const VISITED_CELL_TINT_PERCENT = 28;

/**
 * 道の `progress`（始点 0 〜 全マスを通り終える所 1）での色。
 * 道の長さではなく全有効マスに対する位置で決め、道を延ばしても通ったマスの色は変わらない。
 */
export function getPathColor(progress: number): string {
  const toPercent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  return `color-mix(in oklch, var(--hamiltonian-path-to) ${toPercent}%, var(--hamiltonian-path-from))`;
}

/** 道が `progress` の位置で通ったマスの塗り。 */
export function getVisitedCellColor(progress: number): string {
  // 無彩色の地と oklch で混ぜると色相が回って濁るので、地との混ぜ合わせは oklab で行う。
  return `color-mix(in oklab, ${getPathColor(progress)} ${VISITED_CELL_TINT_PERCENT}%, var(--hamiltonian-path-cell))`;
}
