/** マスの地と数字の色。盤面と遊び方の図で同じ見え方にする。 */
export const nanpureCellToneClassNames = {
  /** 選んだマスと同じ行・列・ブロックのマス。 */
  related: "bg-violet-100/70 dark:bg-violet-950/35",
  /** 選んだマスと同じ数字のマス。 */
  matching: "bg-violet-200/75 dark:bg-violet-900/50",
  selected: "bg-violet-300/80 dark:bg-violet-800/60",
  clue: "font-semibold text-foreground",
  entered: "font-medium text-violet-600 dark:text-violet-300",
  /** 完成解と違う数字。 */
  mistake: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
  /** 同じ行・列・ブロックで重なった数字。 */
  conflict: "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300",
} as const;

export type NanpureCellTone = keyof typeof nanpureCellToneClassNames;
