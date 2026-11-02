import {
  formatHitofudePuzzleBoard,
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";

type CellTransform = (cell: number) => number;

/** マスの写し方で盤面全体（穴と始点の位置）を写す。 */
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

/**
 * 回転・反転した盤面と、元の盤面のマスをその盤面のマスへ写す関数。
 * 解の道など、元の盤面のマスで表した値を写した盤面へ移すのに使う。
 */
export type HitofudePuzzleBoardOrientation = {
  board: HitofudePuzzleBoard;
  transformCell: CellTransform;
};

/** 回転4通り（元の盤面を含む）と、それぞれの左右反転4通り。 */
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

/** 回転4通りとそれぞれの左右反転4通り。 */
export function listHitofudePuzzleBoardSymmetries(
  board: HitofudePuzzleBoard,
): HitofudePuzzleBoard[] {
  return listHitofudePuzzleBoardOrientations(board).map(
    (orientation) => orientation.board,
  );
}

/**
 * 回転・反転で重なる盤面に共通の正規化キー。8通りの盤面それぞれの記法（`formatHitofudePuzzleBoard`）を
 * 改行でつないだ文字列のうち、辞書順で最小のもの。問題集の同型除外に使う。
 */
export function getHitofudePuzzleSymmetryKey(
  board: HitofudePuzzleBoard,
): string {
  const keys = listHitofudePuzzleBoardSymmetries(board).map((symmetry) =>
    formatHitofudePuzzleBoard(symmetry).join("\n"),
  );
  return keys.reduce((minimum, key) => (key < minimum ? key : minimum));
}
