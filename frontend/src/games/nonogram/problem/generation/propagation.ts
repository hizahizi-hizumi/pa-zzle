import {
  type NonogramLineSolver,
  type NonogramSolveCell,
  nonogramSolveCell,
  solveNonogramLineByEdges,
  solveNonogramLineFully,
} from "@/games/nonogram/problem/generation/line-solver";
import {
  getNonogramLineCellIndices,
  listNonogramLines,
  type NonogramGridSize,
  type NonogramLine,
} from "@/games/nonogram/puzzle/board";
import type { NonogramClue, NonogramClues } from "@/games/nonogram/puzzle/clue";

/** 読みの途中の盤面。`cells` は行優先で並べ、読みで決まったマスをその場で書き換える。 */
export type NonogramSolveGrid = NonogramGridSize & {
  cells: NonogramSolveCell[];
};

/**
 * - `complete`: すべてのマスが決まった。
 * - `stalled`: どの行・列を読んでも新しく決まるマスが無いまま、決まらないマスが残った。
 * - `contradicted`: ヒントに合わない行・列が出た。
 */
export type NonogramPropagationStatus = "complete" | "stalled" | "contradicted";

/** 1段で、読める行・列をすべて今の盤面から同時に読んだ結果。 */
export type NonogramReadingRound = {
  /** 新しく決まるマスがあった行・列の数。 */
  progressedLineCount: number;
  /** この段で新しく決まったマスの数。行と列の両方で決まったマスは1つと数える。 */
  fixedCellCount: number;
};

export type NonogramReadingTrace = {
  status: "complete" | "stalled";
  rounds: NonogramReadingRound[];
};

type ClueLine = {
  line: NonogramLine;
  clue: NonogramClue;
  cellIndices: number[];
};

function getGridSize(clues: NonogramClues): NonogramGridSize {
  return { width: clues.columns.length, height: clues.rows.length };
}

function listClueLines(clues: NonogramClues): ClueLine[] {
  const size = getGridSize(clues);
  return listNonogramLines(size).map(function toClueLine(line) {
    return {
      line,
      clue:
        (line.axis === "row" ? clues.rows : clues.columns)[line.index] ?? [],
      cellIndices: getNonogramLineCellIndices(size, line),
    };
  });
}

function readLineCells(
  grid: NonogramSolveGrid,
  cellIndices: readonly number[],
): NonogramSolveCell[] {
  return cellIndices.map((cellIndex) => grid.cells[cellIndex]!);
}

function isComplete(grid: NonogramSolveGrid): boolean {
  return grid.cells.every((cell) => cell !== nonogramSolveCell.unknown);
}

export function createUnknownNonogramSolveGrid(
  size: NonogramGridSize,
): NonogramSolveGrid {
  return {
    width: size.width,
    height: size.height,
    cells: new Array<NonogramSolveCell>(size.width * size.height).fill(
      nonogramSolveCell.unknown,
    ),
  };
}

/**
 * 行・列を1本ずつ読み、新しく決まるマスが無くなるまで繰り返す。読んだ結果は `grid` へ書き込む。
 * 線の読みは解を外さないので、行き着く盤面と矛盾の有無は読む順序に依らない。
 */
export function propagateNonogramLineReadings(
  clues: NonogramClues,
  grid: NonogramSolveGrid,
  solveLine: NonogramLineSolver = solveNonogramLineFully,
): NonogramPropagationStatus {
  const clueLines = listClueLines(clues);
  const linesThroughCell = grid.cells.map((): ClueLine[] => []);
  for (const clueLine of clueLines) {
    for (const cellIndex of clueLine.cellIndices) {
      linesThroughCell[cellIndex]!.push(clueLine);
    }
  }

  const pending = new Set(clueLines);
  for (const clueLine of pending) {
    pending.delete(clueLine);
    const cells = readLineCells(grid, clueLine.cellIndices);
    const solved = solveLine(clueLine.clue, cells);
    if (solved === null) {
      return "contradicted";
    }
    for (const [position, cellIndex] of clueLine.cellIndices.entries()) {
      if (cells[position] !== nonogramSolveCell.unknown) {
        continue;
      }
      const value = solved[position]!;
      if (value === nonogramSolveCell.unknown) {
        continue;
      }
      grid.cells[cellIndex] = value;
      for (const crossingLine of linesThroughCell[cellIndex]!) {
        if (crossingLine !== clueLine) {
          pending.add(crossingLine);
        }
      }
    }
  }
  return isComplete(grid) ? "complete" : "stalled";
}

/**
 * 1本ずつの完全な線の読みだけで、仮置きせずに全マスが決まるか。
 * 線の読みは解を外さないので、全マスが決まればその盤面がただ1つの解になる。
 */
export function isNonogramLineSolvable(clues: NonogramClues): boolean {
  const grid = createUnknownNonogramSolveGrid(getGridSize(clues));
  return propagateNonogramLineReadings(clues, grid) === "complete";
}

/**
 * 段ごとに、読める行・列をすべて段の始めの盤面から同時に完全な線の読みで読み、決まったマスを段の終わりにまとめて書き込む。
 * 読む順序に依らない段の数と、各段で進めた行・列の数を測るための読み方。
 */
export function traceNonogramReadingRounds(
  clues: NonogramClues,
): NonogramReadingTrace {
  const clueLines = listClueLines(clues);
  const grid = createUnknownNonogramSolveGrid(getGridSize(clues));
  const rounds: NonogramReadingRound[] = [];
  while (!isComplete(grid)) {
    const fixedValues = new Map<number, NonogramSolveCell>();
    let progressedLineCount = 0;
    for (const { clue, cellIndices } of clueLines) {
      const cells = readLineCells(grid, cellIndices);
      if (!cells.includes(nonogramSolveCell.unknown)) {
        continue;
      }
      const solved = solveNonogramLineFully(clue, cells);
      if (solved === null) {
        throw new Error("Nonogram clues must have a solution");
      }
      let progressed = false;
      for (const [position, cellIndex] of cellIndices.entries()) {
        const value = solved[position]!;
        if (
          cells[position] === nonogramSolveCell.unknown &&
          value !== nonogramSolveCell.unknown
        ) {
          progressed = true;
          fixedValues.set(cellIndex, value);
        }
      }
      if (progressed) {
        progressedLineCount += 1;
      }
    }
    if (progressedLineCount === 0) {
      return { status: "stalled", rounds };
    }
    for (const [cellIndex, value] of fixedValues) {
      grid.cells[cellIndex] = value;
    }
    rounds.push({ progressedLineCount, fixedCellCount: fixedValues.size });
  }
  return { status: "complete", rounds };
}

/** 1本を完全な線の読みで読み、新しく決まったマスを `grid` へ書き込む。決まったマスがあったか。 */
function readLineFullyInto(
  grid: NonogramSolveGrid,
  clueLine: ClueLine,
): boolean {
  const cells = readLineCells(grid, clueLine.cellIndices);
  const solved = solveNonogramLineFully(clueLine.clue, cells);
  if (solved === null) {
    throw new Error("Nonogram clues must have a solution");
  }
  let progressed = false;
  for (const [position, cellIndex] of clueLine.cellIndices.entries()) {
    const value = solved[position]!;
    if (
      cells[position] === nonogramSolveCell.unknown &&
      value !== nonogramSolveCell.unknown
    ) {
      grid.cells[cellIndex] = value;
      progressed = true;
    }
  }
  return progressed;
}

/**
 * 端寄せの読みだけでは止まり、完全な線の読みで初めて進む読みが何回要るか。
 * 端寄せの読みを止まるまで進め、止まったら完全な線の読みで進む最初の1本（行を上から、続けて列を左から）だけを読む、を解き終えるまで繰り返す。
 * 完全な線の読みでも止まる（仮置きが要るか、解が複数ある）なら `null`。
 */
export function countNonogramReadingsBeyondEdges(
  clues: NonogramClues,
): number | null {
  const clueLines = listClueLines(clues);
  const grid = createUnknownNonogramSolveGrid(getGridSize(clues));
  let readingCount = 0;
  for (;;) {
    const status = propagateNonogramLineReadings(
      clues,
      grid,
      solveNonogramLineByEdges,
    );
    if (status === "contradicted") {
      throw new Error("Nonogram clues must have a solution");
    }
    if (status === "complete") {
      return readingCount;
    }
    const progressed = clueLines.some((clueLine) =>
      readLineFullyInto(grid, clueLine),
    );
    if (!progressed) {
      return null;
    }
    readingCount += 1;
  }
}
