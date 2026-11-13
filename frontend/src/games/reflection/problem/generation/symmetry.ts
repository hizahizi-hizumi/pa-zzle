import { toReflectionCellCode } from "@/games/reflection/problem/generation/cell-code";
import type {
  ReflectionBoard,
  ReflectionCell,
} from "@/games/reflection/puzzle/board";

type CellTransform = Readonly<
  Record<NonNullable<ReflectionCell>, ReflectionCell>
>;

const cellAfterClockwiseRotation = {
  slash: "backslash",
  backslash: "slash",
  "vertical-double": "horizontal-double",
  "horizontal-double": "vertical-double",
  reflector: "reflector",
  "black-hole": "black-hole",
} as const satisfies CellTransform;

const cellAfterLeftRightMirror = {
  slash: "backslash",
  backslash: "slash",
  "vertical-double": "vertical-double",
  "horizontal-double": "horizontal-double",
  reflector: "reflector",
  "black-hole": "black-hole",
} as const satisfies CellTransform;

function transformCell(
  cell: ReflectionCell,
  transform: CellTransform,
): ReflectionCell {
  return cell === null ? null : transform[cell];
}

export function rotateReflectionBoardClockwise(
  board: ReflectionBoard,
): ReflectionBoard {
  const { size } = board;
  const cells = Array.from(
    { length: size * size },
    function cellAfterRotation(_, cellIndex) {
      const row = Math.floor(cellIndex / size);
      const column = cellIndex % size;
      const sourceIndex = (size - 1 - column) * size + row;
      return transformCell(
        board.cells[sourceIndex] ?? null,
        cellAfterClockwiseRotation,
      );
    },
  );
  return { size, cells };
}

export function mirrorReflectionBoardLeftRight(
  board: ReflectionBoard,
): ReflectionBoard {
  const { size } = board;
  const cells = Array.from(
    { length: size * size },
    function cellAfterMirror(_, cellIndex) {
      const row = Math.floor(cellIndex / size);
      const column = cellIndex % size;
      const sourceIndex = row * size + (size - 1 - column);
      return transformCell(
        board.cells[sourceIndex] ?? null,
        cellAfterLeftRightMirror,
      );
    },
  );
  return { size, cells };
}

export function listReflectionBoardSymmetries(
  board: ReflectionBoard,
): ReflectionBoard[] {
  const rotations = [board];
  for (let turn = 1; turn < 4; turn += 1) {
    rotations.push(rotateReflectionBoardClockwise(rotations[turn - 1]!));
  }
  return [...rotations, ...rotations.map(mirrorReflectionBoardLeftRight)];
}

/** 外周ヒントは盤面から決まるので、盤面が同型なら問題も同型になる。 */
export function getReflectionSymmetryKey(board: ReflectionBoard): string {
  const keys = listReflectionBoardSymmetries(board).map((symmetry) =>
    symmetry.cells.map(toReflectionCellCode).join(""),
  );
  return keys.reduce((minimum, key) => (key < minimum ? key : minimum));
}
