import {
  areNanpureCellsRelated,
  NANPURE_BLOCK_SIZE,
  type NanpureBoard,
  type NanpureCell,
} from "@/games/nanpure/puzzle/board";
import { cn } from "@/lib/utils";

/** マスの地と数字の色。盤面と遊び方の図で同じ見え方にする。 */
export const nanpureCellToneClassNames = {
  sameUnitAsSelected: "bg-violet-100/70 dark:bg-violet-950/35",
  sameDigitAsSelected: "bg-violet-200/75 dark:bg-violet-900/50",
  selected: "bg-violet-300/80 dark:bg-violet-800/60",
  clue: "font-semibold text-foreground",
  entered: "font-medium text-violet-600 dark:text-violet-300",
  mistake: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
  /** 同じ行・列・ブロックで重なった数字。 */
  conflict: "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300",
} as const;

export type NanpureCellTone = keyof typeof nanpureCellToneClassNames;

/** 盤面の外枠と地。盤面と遊び方の図で同じ見え方にする。 */
export const nanpureBoardFrameClassName =
  "border-2 border-foreground/55 bg-background";

/** 押せるマスのフォーカスの地。 */
export const nanpureCellFocusClassName =
  "outline-none focus-visible:bg-violet-200 dark:focus-visible:bg-violet-900/55";

/** 選んだマスに対する、マスの関係。 */
export type NanpureCellSelectionRelation = {
  selected: boolean;
  sameUnitAsSelected: boolean;
  sameDigitAsSelected: boolean;
};

/** 選んだマスと、同じ行・列・ブロックのマスと、選んだマスと同じ数字のマスを見分ける。 */
export function getNanpureCellSelectionRelation(
  board: NanpureBoard,
  selectedCellIndex: number | null,
  cellIndex: number,
): NanpureCellSelectionRelation {
  if (selectedCellIndex === null) {
    return {
      selected: false,
      sameUnitAsSelected: false,
      sameDigitAsSelected: false,
    };
  }
  const selected = selectedCellIndex === cellIndex;
  const selectedValue = board[selectedCellIndex] ?? null;
  return {
    selected,
    sameUnitAsSelected:
      !selected && areNanpureCellsRelated(selectedCellIndex, cellIndex),
    sameDigitAsSelected:
      !selected && selectedValue !== null && board[cellIndex] === selectedValue,
  };
}

type NanpureCellToneInput = NanpureCellSelectionRelation & {
  value: NanpureCell;
  clue: boolean;
  mistake: boolean;
  conflict: boolean;
};

/** マスの地と数字の色のクラス。後に並べたものほど強く、重なりと答えと違う数字の色を選んだ地より前に出す。 */
export function getNanpureCellToneClassName({
  selected,
  sameUnitAsSelected,
  sameDigitAsSelected,
  value,
  clue,
  mistake,
  conflict,
}: NanpureCellToneInput): string {
  return cn(
    sameUnitAsSelected && nanpureCellToneClassNames.sameUnitAsSelected,
    sameDigitAsSelected && nanpureCellToneClassNames.sameDigitAsSelected,
    selected && nanpureCellToneClassNames.selected,
    clue && nanpureCellToneClassNames.clue,
    !clue && value !== null && nanpureCellToneClassNames.entered,
    mistake && nanpureCellToneClassNames.mistake,
    conflict && nanpureCellToneClassNames.conflict,
  );
}

type NanpureCellLineInput = {
  /** 9×9 の盤面での行と列（0始まり）。ブロックの境目を決める。 */
  row: number;
  column: number;
  /** 描く盤面の最後の行と列。そこには線を引かず、外枠に任せる。 */
  lastRow: number;
  lastColumn: number;
};

/** マスの下と右の線。ブロックの境目は太線にする。盤面と遊び方の図で同じ線にする。 */
export function getNanpureCellLineClassName({
  row,
  column,
  lastRow,
  lastColumn,
}: NanpureCellLineInput): string {
  const lastInBlock = NANPURE_BLOCK_SIZE - 1;
  return cn(
    row !== lastRow && "border-b border-b-border",
    column !== lastColumn && "border-r border-r-border",
    row % NANPURE_BLOCK_SIZE === lastInBlock &&
      row !== lastRow &&
      "border-b-2 border-b-foreground/55",
    column % NANPURE_BLOCK_SIZE === lastInBlock &&
      column !== lastColumn &&
      "border-r-2 border-r-foreground/55",
  );
}
