import { isRecordObject } from "@/lib/type-guards";

const NANPURE_CELL_COUNT = 81;
const WATER_SORT_BOTTLE_CAPACITY = 4;

function isNanpureDigit(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 9
  );
}

export type Issue690BoardSnapshot =
  | {
      gameId: "water-sort";
      bottles: readonly (readonly number[])[];
      palette: readonly string[];
      lastMove: {
        sourceBottleIndex: number;
        destinationBottleIndex: number;
      } | null;
      /** 記録はボトルの最終配置を保存しないため、再現した完成配置と区別する。 */
      reconstructed: boolean;
    }
  | {
      gameId: "nanpure";
      board: readonly (number | null)[];
      clues: readonly (number | null)[];
      lastCellIndex: number | null;
      reconstructed: boolean;
    };

export function isIssue690BoardSnapshot(
  value: unknown,
): value is Issue690BoardSnapshot {
  if (!isRecordObject(value) || typeof value.reconstructed !== "boolean") {
    return false;
  }

  if (value.gameId === "water-sort") {
    const bottles = value.bottles;
    const palette = value.palette;
    const move = value.lastMove;
    return (
      Array.isArray(bottles) &&
      bottles.length >= 2 &&
      bottles.length <= 20 &&
      Array.isArray(palette) &&
      palette.length >= 1 &&
      palette.length <= 20 &&
      palette.every(
        (color: unknown) =>
          typeof color === "string" && color.length > 0 && color.length < 48,
      ) &&
      bottles.every(
        (bottle) =>
          Array.isArray(bottle) &&
          bottle.length <= WATER_SORT_BOTTLE_CAPACITY &&
          bottle.every(
            (color: unknown) =>
              typeof color === "number" &&
              Number.isInteger(color) &&
              color >= 0 &&
              color < palette.length,
          ),
      ) &&
      (move === null ||
        (isRecordObject(move) &&
          Number.isInteger(move.sourceBottleIndex) &&
          Number.isInteger(move.destinationBottleIndex) &&
          (move.sourceBottleIndex as number) >= 0 &&
          (move.destinationBottleIndex as number) >= 0 &&
          (move.sourceBottleIndex as number) < bottles.length &&
          (move.destinationBottleIndex as number) < bottles.length))
    );
  }

  if (value.gameId === "nanpure") {
    const { board, clues, lastCellIndex } = value;
    return (
      Array.isArray(board) &&
      Array.isArray(clues) &&
      board.length === NANPURE_CELL_COUNT &&
      clues.length === NANPURE_CELL_COUNT &&
      board.every(isNanpureDigit) &&
      clues.every(
        (digit: unknown, index: number) =>
          digit === null || (isNanpureDigit(digit) && digit === board[index]),
      ) &&
      (lastCellIndex === null ||
        (typeof lastCellIndex === "number" &&
          Number.isInteger(lastCellIndex) &&
          lastCellIndex >= 0 &&
          lastCellIndex < NANPURE_CELL_COUNT))
    );
  }

  return false;
}
