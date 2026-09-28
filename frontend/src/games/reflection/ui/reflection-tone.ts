/**
 * リフレクション固有の色。共通UIの意味色（`primary`・`ring` など）は流用しない。
 * - `selection`: 選んでいるピース・ストックの種類・戻し先。
 * - `laser`: 光路と、光路を表示している外周ヒント。線や記号は `laserText`、外周ヒントの数字は
 *   白地でも文字として読める濃さの `laserLabel` を使う。
 */
export const reflectionToneClassNames = {
  selectionText: "text-sky-700 dark:text-sky-300",
  selectionSurface:
    "bg-sky-500/15 ring-2 ring-sky-600 ring-inset dark:bg-sky-400/15 dark:ring-sky-400",
  selectionBorder: "border-sky-600 dark:border-sky-400",
  laserText: "text-orange-600 dark:text-amber-400",
  laserLabel: "text-orange-700 dark:text-amber-400",
  laserSurface: "bg-orange-500/15 dark:bg-amber-400/15",
} as const;
