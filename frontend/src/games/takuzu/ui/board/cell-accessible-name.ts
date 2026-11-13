import type { TakuzuLine } from "@/games/takuzu/puzzle/board";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import { takuzuTileNames } from "@/games/takuzu/ui/board/tile-names";

const lineAxisNames = {
  row: "行",
  column: "列",
} as const satisfies Record<TakuzuLine["axis"], string>;

/** 行・列の違反の読み上げ名（例「行の個数超過」）。違反の無い行・列には `undefined` を渡す。 */
export function listTakuzuLineViolationNames(
  violation: TakuzuLineViolationView | undefined,
): string[] {
  if (!violation) {
    return [];
  }
  return [
    violation.overfilled ? `${lineAxisNames[violation.axis]}の個数超過` : null,
    violation.duplicated ? `${lineAxisNames[violation.axis]}の重複` : null,
  ].filter((name) => name !== null);
}

/** 盤面のマスの読み上げ名。位置・中身・固定・3連続・そのマスを含む行と列の違反の順に並べる。 */
export function getTakuzuCellAccessibleName(
  { row, column }: { row: number; column: number },
  view: TakuzuCellView,
  lineViolationNames: readonly string[],
): string {
  const content = view.cell === null ? "空き" : takuzuTileNames[view.cell];
  const qualifiers = [
    view.given ? "固定" : null,
    view.inViolatingRun ? "3連続" : null,
    ...lineViolationNames,
  ].filter((qualifier) => qualifier !== null);
  return [`${row + 1}行${column + 1}列`, content, ...qualifiers].join(" ");
}
