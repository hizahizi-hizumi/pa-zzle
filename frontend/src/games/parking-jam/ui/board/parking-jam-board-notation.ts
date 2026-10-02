import type {
  ParkingJamBoard,
  ParkingJamCell,
  ParkingJamRoadOpening,
  ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";

/**
 * 図に描く小さな駐車場の記法。
 * `rows` の1文字が1マス。英小文字1字が1台の車で、同じ文字のマスが車の占める範囲になる。
 * `.` は空き。
 */
export type ParkingJamBoardNotation = {
  rows: readonly string[];
  roadOpenings: readonly ParkingJamRoadOpening[];
};

const EMPTY_MARK = ".";

function toVehicle(
  id: string,
  cells: readonly ParkingJamCell[],
): ParkingJamVehicle {
  const [first] = cells;
  const length = cells.length;
  if (!first || (length !== 2 && length !== 3)) {
    throw new RangeError(`Invalid parking jam notation vehicle: ${id}`);
  }
  const horizontal = cells.every(function isSameRow(cell) {
    return cell.row === first.row;
  });
  return {
    id,
    row: Math.min(...cells.map((cell) => cell.row)),
    column: Math.min(...cells.map((cell) => cell.column)),
    orientation: horizontal ? "horizontal" : "vertical",
    length,
  };
}

export function parseParkingJamBoardNotation({
  rows,
  roadOpenings,
}: ParkingJamBoardNotation): ParkingJamBoard {
  const cellsByVehicleId = new Map<string, ParkingJamCell[]>();
  rows.forEach(function collectRowCells(rowMarks, row) {
    Array.from(rowMarks).forEach(function collectCell(mark, column) {
      if (mark === EMPTY_MARK) return;
      const cells = cellsByVehicleId.get(mark) ?? [];
      cells.push({ row, column });
      cellsByVehicleId.set(mark, cells);
    });
  });

  return {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    vehicles: [...cellsByVehicleId].map(function toNotationVehicle([
      id,
      cells,
    ]) {
      return toVehicle(id, cells);
    }),
    fixedAreas: [],
    roadOpenings,
  };
}
