import type { IceFloorMazeProblem } from "@/games/ice-floor-maze/problem/problem";
import type { IceFloorMazeCell } from "@/games/ice-floor-maze/puzzle/board";

type Point = { x: number; y: number };

/** 盤面の形を変えずに、元のマスの位置を移した先の位置へ写す。 */
type ShapePreservingTransform = (
  point: Point,
  width: number,
  height: number,
) => Point;

function mirrorLeftRight({ x, y }: Point, width: number): Point {
  return { x: width - 1 - x, y };
}

function mirrorUpDown({ x, y }: Point, _width: number, height: number): Point {
  return { x, y: height - 1 - y };
}

/** 正方形の盤面だけで形を保つ。 */
function rotateClockwise({ x, y }: Point, width: number): Point {
  return { x: width - 1 - y, y: x };
}

function compose(
  ...transforms: readonly ShapePreservingTransform[]
): ShapePreservingTransform {
  return function composed(point, width, height) {
    return transforms.reduce(
      (current, transform) => transform(current, width, height),
      point,
    );
  };
}

const identity: ShapePreservingTransform = compose();

/** 恒等・左右反転・上下反転・180度回転。90度回転は縦横が入れ替わるので、長方形では含めない。 */
const rectangleTransforms: readonly ShapePreservingTransform[] = [
  identity,
  mirrorLeftRight,
  mirrorUpDown,
  compose(mirrorLeftRight, mirrorUpDown),
];

/** 回転4通りと、それぞれを左右反転した4通り。 */
const squareTransforms: readonly ShapePreservingTransform[] = [
  identity,
  mirrorLeftRight,
].flatMap((reflection) =>
  [0, 1, 2, 3].map((turns) =>
    compose(
      reflection,
      ...Array.from({ length: turns }, () => rotateClockwise),
    ),
  ),
);

function transformProblem(
  problem: IceFloorMazeProblem,
  transform: ShapePreservingTransform,
): IceFloorMazeProblem {
  const { width, height, cells } = problem.board;
  function mapCellIndex(cellIndex: number): number {
    const moved = transform(
      { x: cellIndex % width, y: Math.floor(cellIndex / width) },
      width,
      height,
    );
    return moved.y * width + moved.x;
  }

  const transformedCells = new Array<IceFloorMazeCell>(cells.length);
  for (const [cellIndex, cell] of cells.entries()) {
    transformedCells[mapCellIndex(cellIndex)] = cell;
  }
  return {
    board: { width, height, cells: transformedCells },
    start: mapCellIndex(problem.start),
    goal: mapCellIndex(problem.goal),
  };
}

/** 盤面の形を保つ回転・反転で移した問題。正方形は8通り、長方形は4通り。先頭は元の問題と同じ。 */
export function listIceFloorMazeSymmetries(
  problem: IceFloorMazeProblem,
): IceFloorMazeProblem[] {
  const { width, height } = problem.board;
  const transforms = width === height ? squareTransforms : rectangleTransforms;
  return transforms.map((transform) => transformProblem(problem, transform));
}

const cellCodes = {
  ice: ".",
  rock: "#",
  "brittle-rock": "b",
  "thin-ice": "c",
  outside: "x",
} as const satisfies Record<IceFloorMazeCell, string>;

/** 盤面の大きさは最大168マスなので、マスの番号は3桁で辞書順と数の順が揃う。 */
const cellIndexDigits = 3;

function formatSymmetryKey(problem: IceFloorMazeProblem): string {
  const { width, height, cells } = problem.board;
  return [
    `${width}x${height}`,
    cells.map((cell) => cellCodes[cell]).join(""),
    String(problem.start).padStart(cellIndexDigits, "0"),
    String(problem.goal).padStart(cellIndexDigits, "0"),
  ].join(":");
}

/**
 * 回転・反転で重なる問題に共通の正規化キー。移した問題それぞれのキーのうち辞書順で最小のもの。
 * キーは盤面の形・マスの種類の並び（`.` 氷、`#` 岩、`b` もろい岩、`c` 薄い氷、`x` 盤面の外）・開始位置・ゴールをつなぐ。
 */
export function getIceFloorMazeSymmetryKey(
  problem: IceFloorMazeProblem,
): string {
  return listIceFloorMazeSymmetries(problem)
    .map(formatSymmetryKey)
    .reduce((minimum, key) => (key < minimum ? key : minimum));
}
