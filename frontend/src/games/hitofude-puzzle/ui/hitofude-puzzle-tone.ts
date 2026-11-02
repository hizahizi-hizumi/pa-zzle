/**
 * 一筆パズル固有の色。共通UIの意味色（`primary`・`success`・`error` など）は流用しない。
 * - 道は始点の青緑から、全マスを通り終える所の紫へ、通った順に色を移す。道が盤面を塗り進むほど色が変わり、
 *   蛇行して隣り合う道の列どうしも色の違いで追える。赤・橙はアプリ共通のエラー色と紛れるので使わない。
 * - 道が通ったマスは、そのマスを通ったときの道の色を淡く塗る。
 * - マスの地は、ライトでもダークでも盤面の外の地と分ける。穴は塗らずに盤面の外の地を見せ、外周の欠けと内側の穴を同じものに見せる。
 * - 盤面の外形（通れるマスと、穴・枠の外との境目）は、「この先へは通れない」ことを示す色の線で縁取る。
 *   格子は通常の境界幅、外形は強調の境界幅にし、角は丸めない（外形はマスの辺そのもの）。
 * - 道を延ばせなかったとき、進もうとしたマスに×を短く点ける。×は道の先端と同じ色にし、どの道の操作が阻まれたかを結ぶ。
 * - 行き止まりの先端は、道の色をやめ、外形と同じ「通れない」色で塗った円にマスの地の色の横棒を通す（進入禁止の標識の形）。
 *   灰色に沈めると見落とされ、欠けた輪は読み込み中に見える。アプリ共通のエラー色は使わない。
 * 色の値は `pathColorVariables` の CSS 変数として盤面の根に置き、マスと道の色は `getPathColor` などで混ぜて作る。
 */
export const hitofudePuzzleToneClassNames = {
  pathColorVariables:
    "[--hitofude-puzzle-from:var(--color-cyan-600)] [--hitofude-puzzle-to:var(--color-violet-600)] [--hitofude-puzzle-cell:var(--color-stone-100)] dark:[--hitofude-puzzle-from:var(--color-cyan-400)] dark:[--hitofude-puzzle-to:var(--color-violet-400)] dark:[--hitofude-puzzle-cell:var(--color-stone-800)]",
  unvisitedCell: "fill-(--hitofude-puzzle-cell)",
  gridLine:
    "stroke-stone-300 stroke-(length:--border-width-normal) dark:stroke-stone-600",
  outline:
    "stroke-stone-800 stroke-(length:--border-width-strong) dark:stroke-stone-200",
  /** 阻まれたマスの×の縁取り。道の上でも×が読めるよう、マスの地の色で囲む。 */
  blockedMarkOutline: "stroke-(--hitofude-puzzle-cell)",
  /** 始点の印の縁取り。道の上でも印として浮くよう、マスの地の色で囲む。 */
  startMarkOutline: "stroke-(--hitofude-puzzle-cell)",
  deadEndHead: "fill-stone-800 dark:fill-stone-200",
  deadEndBar: "fill-(--hitofude-puzzle-cell)",
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
  return `color-mix(in oklch, var(--hitofude-puzzle-to) ${toPercent}%, var(--hitofude-puzzle-from))`;
}

/** 道が `progress` の位置で通ったマスの塗り。 */
export function getVisitedCellColor(progress: number): string {
  // 無彩色の地と oklch で混ぜると色相が回って濁るので、地との混ぜ合わせは oklab で行う。
  return `color-mix(in oklab, ${getPathColor(progress)} ${VISITED_CELL_TINT_PERCENT}%, var(--hitofude-puzzle-cell))`;
}
