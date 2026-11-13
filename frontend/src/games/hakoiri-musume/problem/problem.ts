import {
  countHakoiriMusumeCells,
  getHakoiriMusumeCellPosition,
  HAKOIRI_MUSUME_MAX_SIDE,
  HAKOIRI_MUSUME_MAX_TARGETS,
  HAKOIRI_MUSUME_MIN_SIDE,
  type HakoiriMusumeExitSide,
  type HakoiriMusumeGoal,
  type HakoiriMusumeLayout,
  type HakoiriMusumePiece,
  hakoiriMusumePieceShapes,
  isHakoiriMusumePieceInsideBoard,
  listHakoiriMusumePieceCells,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  formatHakoiriMusumeClassicBoard,
  HAKOIRI_MUSUME_CLASSIC_CELL_COUNT,
  hakoiriMusumeClassicLayout,
  isHakoiriMusumeClassicArrangement,
  parseHakoiriMusumeClassicBoard,
} from "@/games/hakoiri-musume/puzzle/classic-board";
import {
  formatHakoiriMusumeArrangement,
  parseHakoiriMusumeArrangement,
} from "@/games/hakoiri-musume/puzzle/notation";
import { isHakoiriMusumeCleared } from "@/games/hakoiri-musume/puzzle/rules";
import { createHakoiriMusumeInitialState } from "@/games/hakoiri-musume/puzzle/state";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { isRecordObject } from "@/lib/type-guards";

/**
 * 1問を遊ぶためのデータ。盤の作りと、始めたときの駒の並び（駒の最初のマスの順）。目標の駒は行き先ごとにちょうど1つで、
 * 始めから全部が行き先に着いてはいない。
 */
export type HakoiriMusumeProblem = {
  layout: HakoiriMusumeLayout;
  pieces: readonly HakoiriMusumePiece[];
};

/** 盤面の書き方が変わり、同じ identity から別の問題ができるようになったら上げる。 */
export const HAKOIRI_MUSUME_GENERATOR_VERSION = "1";

/** 盤の作りも seed の盤面の書き方に含めるので、生成条件は持たない。 */
type HakoiriMusumeProblemConditions = Readonly<Record<never, never>>;

/**
 * 同じ問題を再現するための情報。`seed` は乱数の種ではなく、始めたときの盤面の書き方（`formatHakoiriMusumeProblemSeed`）。
 * 基準の盤の問題は盤面の20文字、ほかの盤の問題は盤の作りを含めた書き方
 * （`formatHakoiriMusumeArrangement`）。
 */
export type HakoiriMusumeProblemIdentity = {
  generatorVersion: typeof HAKOIRI_MUSUME_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: HakoiriMusumeProblemConditions;
};

export type HakoiriMusumeRecordedProblemIdentity = RecordedProblemIdentity;

export type HakoiriMusumeIdentifiedProblem = {
  problem: HakoiriMusumeProblem;
  identity: HakoiriMusumeProblemIdentity;
};

function isSameGoal(left: HakoiriMusumeGoal, right: HakoiriMusumeGoal) {
  return (
    left.exitSide === right.exitSide &&
    left.placements.join() === right.placements.join() &&
    left.exitCells.join() === right.exitCells.join()
  );
}

export function isHakoiriMusumeClassicLayout(
  layout: HakoiriMusumeLayout,
): boolean {
  const classic = hakoiriMusumeClassicLayout;
  return (
    layout.columns === classic.columns &&
    layout.rows === classic.rows &&
    layout.walls.length === 0 &&
    layout.goals.length === classic.goals.length &&
    layout.goals.every((goal, index) => isSameGoal(goal, classic.goals[index]!))
  );
}

function isOnSide(
  layout: HakoiriMusumeLayout,
  side: HakoiriMusumeExitSide,
  cell: number,
): boolean {
  const { row, column } = getHakoiriMusumeCellPosition(layout, cell);
  switch (side) {
    case "top":
      return row === 0;
    case "bottom":
      return row === layout.rows - 1;
    case "left":
      return column === 0;
    case "right":
      return column === layout.columns - 1;
  }
}

function findLayoutDefect(layout: HakoiriMusumeLayout): string | null {
  const isSide = (value: number) =>
    Number.isInteger(value) &&
    value >= HAKOIRI_MUSUME_MIN_SIDE &&
    value <= HAKOIRI_MUSUME_MAX_SIDE;
  if (!isSide(layout.columns) || !isSide(layout.rows)) {
    return "Hakoiri musume board must be 4 to 6 cells on each side";
  }
  const cellCount = countHakoiriMusumeCells(layout);
  const isCell = (cell: number) =>
    Number.isInteger(cell) && cell >= 0 && cell < cellCount;
  if (
    !layout.walls.every(isCell) ||
    new Set(layout.walls).size !== layout.walls.length
  ) {
    return "Hakoiri musume walls must be distinct cells on the board";
  }
  if (
    layout.goals.length === 0 ||
    layout.goals.length > HAKOIRI_MUSUME_MAX_TARGETS
  ) {
    return "Hakoiri musume board must have one or two goals";
  }
  for (const goal of layout.goals) {
    if (goal.placements.length === 0 || !goal.placements.every(isCell)) {
      return "Hakoiri musume goal must have placements on the board";
    }
    const onEdge = goal.exitCells.every(
      (cell) => isCell(cell) && isOnSide(layout, goal.exitSide, cell),
    );
    if (goal.exitCells.length === 0 || !onEdge) {
      return "Hakoiri musume exit must face the side of the board";
    }
  }
  return null;
}

function findProblemDefect({
  layout,
  pieces,
}: HakoiriMusumeProblem): string | null {
  const layoutDefect = findLayoutDefect(layout);
  if (layoutDefect) {
    return layoutDefect;
  }
  const occupied = new Set(layout.walls);
  let firstCell = -1;
  for (const piece of pieces) {
    const inside =
      Object.hasOwn(hakoiriMusumePieceShapes, piece.kind) &&
      Number.isInteger(piece.cell) &&
      piece.cell >= 0 &&
      isHakoiriMusumePieceInsideBoard(
        layout,
        piece.kind,
        getHakoiriMusumeCellPosition(layout, piece.cell),
      );
    if (!inside) {
      return "Hakoiri musume pieces must fit in the box";
    }
    const cells = listHakoiriMusumePieceCells(layout, piece);
    if (cells.some((cell) => occupied.has(cell))) {
      return "Hakoiri musume pieces must not overlap walls or other pieces";
    }
    for (const cell of cells) {
      occupied.add(cell);
    }
    const pieceFirstCell = Math.min(...cells);
    if (pieceFirstCell < firstCell) {
      return "Hakoiri musume pieces must be in order of their first cells";
    }
    firstCell = pieceFirstCell;
  }
  const targets = pieces.flatMap((piece) =>
    piece.target === null ? [] : [piece.target],
  );
  const hasEachTarget =
    targets.length === layout.goals.length &&
    layout.goals.every((_, target) => targets.includes(target));
  if (!hasEachTarget) {
    return "Hakoiri musume problem must have exactly one target piece for each goal";
  }
  const placementsFit = layout.goals.every((goal, target) => {
    const kind = pieces.find((piece) => piece.target === target)!.kind;
    return goal.placements.every((cell) =>
      isHakoiriMusumePieceInsideBoard(
        layout,
        kind,
        getHakoiriMusumeCellPosition(layout, cell),
      ),
    );
  });
  if (!placementsFit) {
    return "Hakoiri musume goal placements must fit the target piece";
  }
  if (isHakoiriMusumeCleared(layout, createHakoiriMusumeInitialState(pieces))) {
    return "Hakoiri musume targets must not all start at their goals";
  }
  return null;
}

/** 目標の駒を行き先へ運べるかは、全部の盤面をたどるので、遊ぶときではなく問題集を作るときに確かめる。 */
export function assertHakoiriMusumeProblem(
  problem: HakoiriMusumeProblem,
): void {
  const defect = findProblemDefect(problem);
  if (defect) {
    throw new RangeError(defect);
  }
}

/** 基準の盤の問題は盤面の20文字、ほかの盤の問題は盤の作りを含めた書き方。 */
export function formatHakoiriMusumeProblemSeed({
  layout,
  pieces,
}: HakoiriMusumeProblem): string {
  return isHakoiriMusumeClassicLayout(layout) &&
    isHakoiriMusumeClassicArrangement(pieces)
    ? formatHakoiriMusumeClassicBoard(pieces)
    : formatHakoiriMusumeArrangement(layout, pieces);
}

/**
 * 盤面の書き方から問題を読む。読めないか、問題として成り立たないか、同じ問題の決まった書き方
 * （`formatHakoiriMusumeProblemSeed`）でなければ `null`。
 */
function decodeHakoiriMusumeProblem(seed: string): HakoiriMusumeProblem | null {
  const problem: HakoiriMusumeProblem | null =
    seed.length === HAKOIRI_MUSUME_CLASSIC_CELL_COUNT
      ? (() => {
          const pieces = parseHakoiriMusumeClassicBoard(seed);
          return pieces && { layout: hakoiriMusumeClassicLayout, pieces };
        })()
      : parseHakoiriMusumeArrangement(seed);
  return problem &&
    findProblemDefect(problem) === null &&
    formatHakoiriMusumeProblemSeed(problem) === seed
    ? problem
    : null;
}

export function createHakoiriMusumeProblemIdentity(
  board: string,
): HakoiriMusumeProblemIdentity {
  return {
    generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
    seed: board,
    conditions: {},
  };
}

/** 生成器は走らせない。 */
export function restoreHakoiriMusumeProblem(
  identity: HakoiriMusumeProblemIdentity,
): HakoiriMusumeIdentifiedProblem {
  if (identity.generatorVersion !== HAKOIRI_MUSUME_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported hakoiri musume generator version: ${identity.generatorVersion}`,
    );
  }
  const problem = decodeHakoiriMusumeProblem(identity.seed);
  if (!problem) {
    throw new RangeError(`Invalid hakoiri musume board: ${identity.seed}`);
  }
  return { problem, identity };
}

export function isCurrentHakoiriMusumeProblemIdentity(
  value: unknown,
): value is HakoiriMusumeProblemIdentity {
  return (
    isRecordObject(value) &&
    value.generatorVersion === HAKOIRI_MUSUME_GENERATOR_VERSION &&
    isRecordObject(value.conditions) &&
    Object.keys(value.conditions).length === 0 &&
    typeof value.seed === "string" &&
    decodeHakoiriMusumeProblem(value.seed) !== null
  );
}

export function isHakoiriMusumeRecordedProblemIdentity(
  value: unknown,
): value is HakoiriMusumeRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
    isProblemIdentity: isCurrentHakoiriMusumeProblemIdentity,
  });
}
