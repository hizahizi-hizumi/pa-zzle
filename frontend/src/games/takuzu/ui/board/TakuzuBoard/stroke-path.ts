import { getTakuzuCellPosition } from "@/games/takuzu/puzzle/board";

/**
 * なぞる指が `fromCellIndex` から `toCellIndex` へ飛んだときに通ったマス。速くなぞって間のマスで指の位置を
 * 受け取れなくても、間のマスを飛ばさないよう、縦横斜めに1マスずつたどる。`fromCellIndex` は含めない。
 */
export function listTakuzuStrokeCellIndices(
  size: number,
  fromCellIndex: number,
  toCellIndex: number,
): number[] {
  const from = getTakuzuCellPosition(size, fromCellIndex);
  const to = getTakuzuCellPosition(size, toCellIndex);
  const steps = Math.max(
    Math.abs(to.row - from.row),
    Math.abs(to.column - from.column),
  );
  return Array.from({ length: steps }, (_, index) => {
    const ratio = (index + 1) / steps;
    const row = Math.round(from.row + (to.row - from.row) * ratio);
    const column = Math.round(from.column + (to.column - from.column) * ratio);
    return row * size + column;
  });
}
