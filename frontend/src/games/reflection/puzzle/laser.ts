import type {
  ReflectionBoard,
  ReflectionCell,
} from "@/games/reflection/puzzle/board";

/** 光の進む向き。`0` が上、`1` が右、`2` が下、`3` が左。 */
export type ReflectionDirection = 0 | 1 | 2 | 3;

/** 外周の辺。 */
export const reflectionSides = ["top", "right", "bottom", "left"] as const;

export type ReflectionSide = (typeof reflectionSides)[number];

/**
 * 外周から光を入れる位置。`index` は上下の辺では左からの列、左右の辺では上からの行。
 */
export type ReflectionEntry = {
  side: ReflectionSide;
  index: number;
};

/**
 * 外周から入れた光の結末。
 * - `exit`: 入れた位置とは別の外周位置から出る。
 * - `reflect`: 入れた位置へ戻って出る。
 * - `absorb`: ブラックホールに吸収される。
 */
export type ReflectionOutcome = "exit" | "reflect" | "absorb";

/**
 * 外周ヒント。`distance` は光が通ったマスの数。入ったマスを1と数え、同じマスを何度通っても通るたびに数える。
 * 吸収ではブラックホールのマスまでを数える。
 */
export type ReflectionClue = {
  outcome: ReflectionOutcome;
  distance: number;
};

/** 光が1マスを通った記録。吸収されたマスでは `leaving` が `null`。 */
export type ReflectionLaserStep = {
  cellIndex: number;
  entering: ReflectionDirection;
  leaving: ReflectionDirection | null;
};

export type ReflectionLaserTrace = ReflectionClue & {
  path: readonly ReflectionLaserStep[];
  /** 光が出た外周位置。吸収では `null`。 */
  exit: ReflectionEntry | null;
};

type Transition = readonly [
  ReflectionDirection | null,
  ReflectionDirection | null,
  ReflectionDirection | null,
  ReflectionDirection | null,
];

/** 進む向きごとの、マスを出る向き。`null` は吸収。 */
const transitionsByCell = {
  empty: [0, 1, 2, 3],
  slash: [1, 0, 3, 2],
  backslash: [3, 2, 1, 0],
  "vertical-double": [0, 3, 2, 1],
  "horizontal-double": [2, 1, 0, 3],
  reflector: [2, 3, 0, 1],
  "black-hole": [null, null, null, null],
} as const satisfies Record<NonNullable<ReflectionCell> | "empty", Transition>;

const rowStepByDirection = [-1, 0, 1, 0] as const;
const columnStepByDirection = [0, 1, 0, -1] as const;

export function getReflectionLeavingDirection(
  cell: ReflectionCell,
  entering: ReflectionDirection,
): ReflectionDirection | null {
  return transitionsByCell[cell ?? "empty"][entering];
}

export function stepReflectionPosition(
  row: number,
  column: number,
  direction: ReflectionDirection,
): { row: number; column: number } {
  return {
    row: row + rowStepByDirection[direction],
    column: column + columnStepByDirection[direction],
  };
}

/** 外周の辺・位置ごとに、光が入るマスと進む向き。 */
export function getReflectionEntryState(
  size: number,
  { side, index }: ReflectionEntry,
): { row: number; column: number; direction: ReflectionDirection } {
  switch (side) {
    case "top":
      return { row: 0, column: index, direction: 2 };
    case "right":
      return { row: index, column: size - 1, direction: 3 };
    case "bottom":
      return { row: size - 1, column: index, direction: 0 };
    case "left":
      return { row: index, column: 0, direction: 1 };
  }
}

/** 盤面の外へ出た位置を、その外周位置として読む。盤面の中なら `null`。 */
export function getReflectionExitEntry(
  size: number,
  row: number,
  column: number,
): ReflectionEntry | null {
  if (row < 0) {
    return { side: "top", index: column };
  }
  if (row >= size) {
    return { side: "bottom", index: column };
  }
  if (column < 0) {
    return { side: "left", index: row };
  }
  if (column >= size) {
    return { side: "right", index: row };
  }
  return null;
}

export function isSameReflectionEntry(
  left: ReflectionEntry,
  right: ReflectionEntry,
): boolean {
  return left.side === right.side && left.index === right.index;
}

/** 外周ヒントの並び順。上辺・右辺・下辺・左辺の順に、各辺の `index` 昇順。 */
export function listReflectionEntries(size: number): ReflectionEntry[] {
  return reflectionSides.flatMap(function listSideEntries(side) {
    return Array.from({ length: size }, (_, index) => ({ side, index }));
  });
}

/** 外周位置の、`listReflectionEntries` の並びでの番号。 */
export function getReflectionEntryIndex(
  size: number,
  { side, index }: ReflectionEntry,
): number {
  return reflectionSides.indexOf(side) * size + index;
}

/**
 * 外周の1か所から光を入れ、出るか吸収されるまで追う。
 * 各ピースの遷移は向きの入れ替えなので、外周から入った光は必ず外へ出るか吸収され、盤面内で回り続けない。
 */
export function traceReflectionLaser(
  board: ReflectionBoard,
  entry: ReflectionEntry,
): ReflectionLaserTrace {
  const { size } = board;
  let { row, column, direction } = getReflectionEntryState(size, entry);
  const path: ReflectionLaserStep[] = [];
  const maximumStepCount = size * size * 4;

  while (path.length < maximumStepCount) {
    const cellIndex = row * size + column;
    const leaving = getReflectionLeavingDirection(
      board.cells[cellIndex] ?? null,
      direction,
    );
    path.push({ cellIndex, entering: direction, leaving });
    if (leaving === null) {
      return { outcome: "absorb", distance: path.length, path, exit: null };
    }

    ({ row, column } = stepReflectionPosition(row, column, leaving));
    const exit = getReflectionExitEntry(size, row, column);
    if (exit !== null) {
      const outcome = isSameReflectionEntry(exit, entry) ? "reflect" : "exit";
      return { outcome, distance: path.length, path, exit };
    }
    direction = leaving;
  }
  throw new Error("A Reflection laser must leave the board or be absorbed");
}

/** 盤面から全外周ヒントを求める。並びは `listReflectionEntries` に従う。 */
export function computeReflectionClues(
  board: ReflectionBoard,
): ReflectionClue[] {
  return listReflectionEntries(board.size).map(function computeClue(entry) {
    const { outcome, distance } = traceReflectionLaser(board, entry);
    return { outcome, distance };
  });
}

export function isSameReflectionClue(
  left: ReflectionClue,
  right: ReflectionClue,
): boolean {
  return left.outcome === right.outcome && left.distance === right.distance;
}

export function areSameReflectionClues(
  left: readonly ReflectionClue[],
  right: readonly ReflectionClue[],
): boolean {
  return (
    left.length === right.length &&
    left.every((clue, index) => {
      const other = right[index];
      return other !== undefined && isSameReflectionClue(clue, other);
    })
  );
}
