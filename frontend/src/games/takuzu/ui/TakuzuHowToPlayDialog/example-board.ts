import { TAKUZU_BOARD_SIZE } from "@/games/takuzu/problem/problem";
import {
  getTakuzuLineCells,
  type TakuzuBoard,
  type TakuzuCell,
  type TakuzuLine,
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";
import {
  findTakuzuRuleViolations,
  hasTakuzuRuleViolation,
} from "@/games/takuzu/puzzle/rules";
import {
  getNextTakuzuCell,
  isTakuzuGivenCell,
  placeTakuzuCell,
  type TakuzuCycleDirection,
} from "@/games/takuzu/puzzle/transitions";
import type { TakuzuHowToPlayFigureBoard } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";

/**
 * 遊び方の例の盤面。本番と同じ大きさの盤面の左上に例を置き、残りを空きにして持つ。
 * 空きはどのルールにも反しないので、例の外のマスが判定を変えることはない。
 * 遷移と判定は本番の `puzzle/` の関数をそのままかけ、遊び方の中で作り直さない。
 */
export type TakuzuExampleBoard = {
  rowCount: number;
  columnCount: number;
  givens: TakuzuBoard;
  board: TakuzuBoard;
};

/** 例のマスに出す違反の印。本番の判定を、例の範囲のマスと行・列に移したもの。 */
export type TakuzuExampleMarks = {
  /** 3連続の印を付けるマス。例の中の行優先の番号。 */
  runCells: readonly number[];
  violatedRows: readonly number[];
  violatedColumns: readonly number[];
  /** 個数超過の行・列。例の範囲のものだけ。 */
  overfilledLines: readonly TakuzuLine[];
  /** 重複の行・列。例の範囲のものだけ。 */
  duplicateLines: readonly TakuzuLine[];
};

/**
 * 例の1つの行・列の四角と丸の数と、本番の判定でその行・列が置ける数を超えたとされたときの、超えた方のタイル。
 * 超えていなければ `overfilledTile` は `null`。
 */
export type TakuzuExampleLineTileCounts = {
  counts: Record<TakuzuTile, number>;
  overfilledTile: TakuzuTile | null;
};

export type TakuzuExampleTapResult = {
  example: TakuzuExampleBoard;
  /** 押したマスの、例を置いた本番の大きさの盤面での番号。 */
  cellIndex: number;
  /** 押した後のマスの中身。 */
  cell: TakuzuCell;
  /** 最初からあるタイルを押して、何も変わらなかった。 */
  rejected: boolean;
};

function toBoardIndex(
  { columnCount }: Pick<TakuzuExampleBoard, "columnCount">,
  figureIndex: number,
): number {
  return (
    Math.floor(figureIndex / columnCount) * TAKUZU_BOARD_SIZE +
    (figureIndex % columnCount)
  );
}

export function createTakuzuExampleBoard({
  rows,
}: TakuzuHowToPlayFigureBoard): TakuzuExampleBoard {
  const cellCount = TAKUZU_BOARD_SIZE * TAKUZU_BOARD_SIZE;
  const givens: TakuzuCell[] = Array.from({ length: cellCount }, () => null);
  const cells: TakuzuCell[] = Array.from({ length: cellCount }, () => null);
  rows.forEach((marks, row) => {
    Array.from(marks).forEach((mark, column) => {
      const cellIndex = row * TAKUZU_BOARD_SIZE + column;
      const tile = mark.toLowerCase();
      if (tile !== "a" && tile !== "b") {
        return;
      }
      cells[cellIndex] = tile;
      if (mark !== tile) {
        givens[cellIndex] = tile;
      }
    });
  });
  return {
    rowCount: rows.length,
    columnCount: rows[0]?.length ?? 0,
    givens: { size: TAKUZU_BOARD_SIZE, cells: givens },
    board: { size: TAKUZU_BOARD_SIZE, cells },
  };
}

/** 例のマスを、行優先で並べる。 */
export function listTakuzuExampleCells(
  example: TakuzuExampleBoard,
): { cell: TakuzuCell; given: boolean }[] {
  return Array.from(
    { length: example.rowCount * example.columnCount },
    function toCell(_, figureIndex) {
      const cellIndex = toBoardIndex(example, figureIndex);
      return {
        cell: example.board.cells[cellIndex] ?? null,
        given: isTakuzuGivenCell(example.givens, cellIndex),
      };
    },
  );
}

/** 本番と同じく、押したマスを巡回の順に1つ進める。最初からあるタイルは変えない。 */
export function tapTakuzuExampleCell(
  example: TakuzuExampleBoard,
  figureIndex: number,
  direction: TakuzuCycleDirection,
): TakuzuExampleTapResult {
  const cellIndex = toBoardIndex(example, figureIndex);
  const board = placeTakuzuCell(
    example.givens,
    example.board,
    cellIndex,
    getNextTakuzuCell(example.board.cells[cellIndex] ?? null, direction),
  );
  return {
    example: board === example.board ? example : { ...example, board },
    cellIndex,
    cell: board.cells[cellIndex] ?? null,
    rejected: isTakuzuGivenCell(example.givens, cellIndex),
  };
}

function isLineInExample(
  example: TakuzuExampleBoard,
  { axis, index }: TakuzuLine,
): boolean {
  return index < (axis === "row" ? example.rowCount : example.columnCount);
}

/** 本番の判定で、例に出す違反の印を求める。 */
export function getTakuzuExampleMarks(
  example: TakuzuExampleBoard,
): TakuzuExampleMarks {
  const { runCellIndices, overfilledLines, duplicateLines } =
    findTakuzuRuleViolations(example.board);
  const runCellSet = new Set(runCellIndices);
  const overfilledInExample = overfilledLines.filter((line) =>
    isLineInExample(example, line),
  );
  const duplicateInExample = duplicateLines.filter((line) =>
    isLineInExample(example, line),
  );
  const violatedLines = [...overfilledInExample, ...duplicateInExample];
  function listIndices(axis: TakuzuLine["axis"]): number[] {
    return [
      ...new Set(
        violatedLines
          .filter((line) => line.axis === axis)
          .map((line) => line.index),
      ),
    ].sort((left, right) => left - right);
  }
  return {
    runCells: Array.from(
      { length: example.rowCount * example.columnCount },
      (_, figureIndex) => figureIndex,
    ).filter((figureIndex) =>
      runCellSet.has(toBoardIndex(example, figureIndex)),
    ),
    violatedRows: listIndices("row"),
    violatedColumns: listIndices("column"),
    overfilledLines: overfilledInExample,
    duplicateLines: duplicateInExample,
  };
}

/** 本番の判定で、例の今の姿がどのルールにも反していないか。 */
function isTakuzuExampleAllowed(example: TakuzuExampleBoard): boolean {
  return !hasTakuzuRuleViolation(findTakuzuRuleViolations(example.board));
}

/** 例の行・列の四角と丸の数を数え、超えた方のタイルは本番の判定の `overfilledLines` から決める。 */
export function getTakuzuExampleLineTileCounts(
  example: TakuzuExampleBoard,
  line: TakuzuLine,
): TakuzuExampleLineTileCounts {
  const cells = getTakuzuLineCells(example.board, line);
  const counts = {
    a: cells.filter((cell) => cell === "a").length,
    b: cells.filter((cell) => cell === "b").length,
  };
  const overfilled = findTakuzuRuleViolations(
    example.board,
  ).overfilledLines.some(
    ({ axis, index }) => axis === line.axis && index === line.index,
  );
  // 1つの行・列で2種類のタイルがどちらも半分を超えることはないので、超えたのは多い方のタイル。
  return {
    counts,
    overfilledTile: overfilled ? (counts.a > counts.b ? "a" : "b") : null,
  };
}

/**
 * 本番の判定で置ける数を超えたとされた例の行・列にある、超えた方のタイルのマス。例の中の行優先の番号で、小さい順に返す。
 */
export function listTakuzuExampleOverfilledTileCells(
  example: TakuzuExampleBoard,
): number[] {
  const cells = listTakuzuExampleCells(example);
  const overfilledCells = new Set<number>();
  for (const line of getTakuzuExampleMarks(example).overfilledLines) {
    const { overfilledTile } = getTakuzuExampleLineTileCounts(example, line);
    cells.forEach(({ cell }, figureIndex) => {
      const position =
        line.axis === "row"
          ? Math.floor(figureIndex / example.columnCount)
          : figureIndex % example.columnCount;
      if (position === line.index && cell === overfilledTile) {
        overfilledCells.add(figureIndex);
      }
    });
  }
  return [...overfilledCells].sort((left, right) => left - right);
}

/**
 * 例の今の姿が反しているルール。本番の判定から求める。
 * - `run`: 同じタイルが3つ以上続いている。
 * - `overfilled`: 行・列のどちらかのタイルが置ける数を超えている。超えたタイルとその数を添える。
 * - `duplicate`: 埋まった行・列が同じ並びになっている。
 */
export type TakuzuExampleViolation =
  | { kind: "run" }
  | { kind: "overfilled"; tile: TakuzuTile; count: number }
  | { kind: "duplicate" };

/** 例の今の姿が反しているルールを、3つ続く・数・同じ並びの順に、種類ごとに1つずつ返す。 */
export function listTakuzuExampleViolations(
  example: TakuzuExampleBoard,
): TakuzuExampleViolation[] {
  const { runCellIndices, overfilledLines, duplicateLines } =
    findTakuzuRuleViolations(example.board);
  const violations: TakuzuExampleViolation[] = [];
  if (runCellIndices.length > 0) {
    violations.push({ kind: "run" });
  }
  const [overfilledLine] = overfilledLines;
  if (overfilledLine !== undefined) {
    const { counts, overfilledTile } = getTakuzuExampleLineTileCounts(
      example,
      overfilledLine,
    );
    if (overfilledTile !== null) {
      violations.push({
        kind: "overfilled",
        tile: overfilledTile,
        count: counts[overfilledTile],
      });
    }
  }
  if (duplicateLines.length > 0) {
    violations.push({ kind: "duplicate" });
  }
  return violations;
}

/**
 * 例の今の姿の判定。
 * - `allowed`: どのルールにも反していない。
 * - `incomplete`: どのルールにも反していないが、判定する行・列がまだ埋まっていない。
 * - `disallowed`: どれかのルールに反している。空きがあっても反していれば `disallowed`。
 */
export type TakuzuExampleVerdict = "allowed" | "incomplete" | "disallowed";

/**
 * 本番の判定で、例の今の姿を判定する。
 * `waitsForFilledLines` は、行・列を埋め切ってから決まるルール（4つずつ・違う並び）の例か。
 * そうした例では、空きのある間は ✓ を出さずに途中とする。
 */
export function judgeTakuzuExample(
  example: TakuzuExampleBoard,
  waitsForFilledLines: boolean,
): TakuzuExampleVerdict {
  if (!isTakuzuExampleAllowed(example)) {
    return "disallowed";
  }
  const filled = listTakuzuExampleCells(example).every(
    ({ cell }) => cell !== null,
  );
  return waitsForFilledLines && !filled ? "incomplete" : "allowed";
}

/**
 * 押す所の手がかりを付けるマス。`pressedCells` を1回ずつ押していく途中の姿なら、まだ押していない最初のマスを返す。
 * 押し終えた姿や、ほかのマスを押した姿、同じマスを2回以上押した姿では `null`。
 * 押す順は問わないので、後のマスを先に押しても、残りのマスに手がかりを移す。
 */
export function findTakuzuExampleHintCell(
  figure: TakuzuHowToPlayFigureBoard,
  example: TakuzuExampleBoard,
): number | null {
  const direction = figure.pressDirection ?? "forward";
  const pressedCells = figure.pressedCells ?? [];
  const initialCells = listTakuzuExampleCells(createTakuzuExampleBoard(figure));
  const currentCells = listTakuzuExampleCells(example);
  const onPath = currentCells.every(({ cell }, figureIndex) => {
    const initial = initialCells[figureIndex]?.cell ?? null;
    return (
      cell === initial ||
      (pressedCells.includes(figureIndex) &&
        cell === getNextTakuzuCell(initial, direction))
    );
  });
  if (!onPath) {
    return null;
  }
  return (
    pressedCells.find(
      (figureIndex) =>
        currentCells[figureIndex]?.cell === initialCells[figureIndex]?.cell,
    ) ?? null
  );
}

/**
 * 2行の例で、上と下のマスがどちらも埋まっていて違う列。見比べる所の印を付ける列になる。2行でない例では空。
 */
export function listTakuzuExampleDifferingColumns(
  example: TakuzuExampleBoard,
): number[] {
  const { rowCount, columnCount } = example;
  if (rowCount !== 2) {
    return [];
  }
  const cells = listTakuzuExampleCells(example);
  return Array.from({ length: columnCount }, (_, column) => column).filter(
    (column) => {
      const top = cells[column]?.cell ?? null;
      const bottom = cells[columnCount + column]?.cell ?? null;
      return top !== null && bottom !== null && top !== bottom;
    },
  );
}
