import {
  formatHitofudePuzzleBoard,
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";

type CellTransform = (cell: number) => number;

function transformBoard(
  board: HitofudePuzzleBoard,
  transformCell: CellTransform,
): HitofudePuzzleBoard {
  return {
    size: board.size,
    holes: board.holes.map(transformCell).sort((left, right) => left - right),
    start: transformCell(board.start),
  };
}

function rotateCellClockwise(size: number): CellTransform {
  return function rotateCell(cell) {
    const { row, column } = getHitofudePuzzleCellPosition(size, cell);
    return column * size + (size - 1 - row);
  };
}

function mirrorCellLeftRight(size: number): CellTransform {
  return function mirrorCell(cell) {
    const { row, column } = getHitofudePuzzleCellPosition(size, cell);
    return row * size + (size - 1 - column);
  };
}

function thenTransform(
  first: CellTransform,
  second: CellTransform,
): CellTransform {
  return function transformCell(cell) {
    return second(first(cell));
  };
}

export function rotateHitofudePuzzleBoardClockwise(
  board: HitofudePuzzleBoard,
): HitofudePuzzleBoard {
  return transformBoard(board, rotateCellClockwise(board.size));
}

export function mirrorHitofudePuzzleBoardLeftRight(
  board: HitofudePuzzleBoard,
): HitofudePuzzleBoard {
  return transformBoard(board, mirrorCellLeftRight(board.size));
}

export type HitofudePuzzleBoardOrientation = {
  board: HitofudePuzzleBoard;
  /** 元の盤面のマスを `board` のマスへ写す。解の道など、元の盤面のマスで表した値を写した盤面へ移すのに使う。 */
  transformCell: CellTransform;
};

export function listHitofudePuzzleBoardOrientations(
  board: HitofudePuzzleBoard,
): HitofudePuzzleBoardOrientation[] {
  const rotate = rotateCellClockwise(board.size);
  const mirror = mirrorCellLeftRight(board.size);
  const rotations: CellTransform[] = [
    function keepCell(cell) {
      return cell;
    },
  ];
  for (let turn = 1; turn < 4; turn += 1) {
    rotations.push(thenTransform(rotations[turn - 1]!, rotate));
  }
  const transforms = [
    ...rotations,
    ...rotations.map((rotation) => thenTransform(rotation, mirror)),
  ];
  return transforms.map((transformCell) => ({
    board: transformBoard(board, transformCell),
    transformCell,
  }));
}

export function listHitofudePuzzleBoardSymmetries(
  board: HitofudePuzzleBoard,
): HitofudePuzzleBoard[] {
  return listHitofudePuzzleBoardOrientations(board).map(
    (orientation) => orientation.board,
  );
}

export function getHitofudePuzzleSymmetryKey(
  board: HitofudePuzzleBoard,
): string {
  const keys = listHitofudePuzzleBoardSymmetries(board).map((symmetry) =>
    formatHitofudePuzzleBoard(symmetry).join("\n"),
  );
  return keys.reduce((minimum, key) => (key < minimum ? key : minimum));
}
