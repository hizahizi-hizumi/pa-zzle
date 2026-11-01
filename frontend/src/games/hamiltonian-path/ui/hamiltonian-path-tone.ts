/**
 * ハミルトン路固有の色。共通UIの意味色（`primary`・`success` など）は流用しない。
 * - 道（線・始点・先端）と、道が通ったマスの塗りは同じ青の系統にし、盤面が塗られていくことを主役にする。
 * - 壁マスと仕切りはどちらも「通れない」ことを示すので、同じ系統の暗い色にする。
 */
export const hamiltonianPathToneClassNames = {
  unvisitedCell: "fill-white dark:fill-stone-800",
  visitedCell: "fill-blue-100 dark:fill-blue-950",
  wallCell: "fill-stone-700 dark:fill-black",
  gridLine: "stroke-stone-300 dark:stroke-stone-600",
  pathLine: "stroke-blue-600 dark:stroke-blue-400",
  pathMark: "fill-blue-600 dark:fill-blue-400",
  headCore: "fill-white dark:fill-stone-800",
  partition: "fill-stone-900 dark:fill-stone-100",
} as const;
