import {
  createHamiltonianPathPartition,
  formatHamiltonianPathBoard,
  getHamiltonianPathCellPosition,
  type HamiltonianPathBoard,
  normalizeHamiltonianPathPartitions,
} from "@/games/hamiltonian-path/puzzle/board";

type CellTransform = (cell: number) => number;

/**
 * マスの写し方で盤面全体を写す。壁マス・始点は位置を、仕切りは両側のマスを写す。
 * 90度回転では、左右のマスの間の仕切りが上下のマスの間の仕切りになる。
 */
function transformBoard(
  board: HamiltonianPathBoard,
  transformCell: CellTransform,
): HamiltonianPathBoard {
  return {
    size: board.size,
    walls: board.walls.map(transformCell).sort((left, right) => left - right),
    partitions: normalizeHamiltonianPathPartitions(
      board.partitions.map(([left, right]) =>
        createHamiltonianPathPartition(
          transformCell(left),
          transformCell(right),
        ),
      ),
    ),
    start: transformCell(board.start),
  };
}

export function rotateHamiltonianPathBoardClockwise(
  board: HamiltonianPathBoard,
): HamiltonianPathBoard {
  const { size } = board;
  return transformBoard(board, function rotateCell(cell) {
    const { row, column } = getHamiltonianPathCellPosition(size, cell);
    return column * size + (size - 1 - row);
  });
}

export function mirrorHamiltonianPathBoardLeftRight(
  board: HamiltonianPathBoard,
): HamiltonianPathBoard {
  const { size } = board;
  return transformBoard(board, function mirrorCell(cell) {
    const { row, column } = getHamiltonianPathCellPosition(size, cell);
    return row * size + (size - 1 - column);
  });
}

/** 回転4通りとそれぞれの左右反転4通り。 */
export function listHamiltonianPathBoardSymmetries(
  board: HamiltonianPathBoard,
): HamiltonianPathBoard[] {
  const rotations = [board];
  for (let turn = 1; turn < 4; turn += 1) {
    rotations.push(rotateHamiltonianPathBoardClockwise(rotations[turn - 1]!));
  }
  return [...rotations, ...rotations.map(mirrorHamiltonianPathBoardLeftRight)];
}

/**
 * 回転・反転で重なる盤面に共通の正規化キー。8通りの盤面それぞれの記法（`formatHamiltonianPathBoard`）を
 * 改行でつないだ文字列のうち、辞書順で最小のもの。問題集の同型除外に使う。
 */
export function getHamiltonianPathSymmetryKey(
  board: HamiltonianPathBoard,
): string {
  const keys = listHamiltonianPathBoardSymmetries(board).map((symmetry) =>
    formatHamiltonianPathBoard(symmetry).join("\n"),
  );
  return keys.reduce((minimum, key) => (key < minimum ? key : minimum));
}
