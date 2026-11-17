import {
  getMinesweeperCellCount,
  getMinesweeperNeighborCellIndices,
  type MinesweeperBoard,
} from "@/games/minesweeper/puzzle/board";
import {
  isMinesweeperCleared,
  isMinesweeperMine,
} from "@/games/minesweeper/puzzle/rules";
import type { MinesweeperPuzzleState } from "@/games/minesweeper/puzzle/state";
import {
  chordMinesweeperCell,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
} from "@/games/minesweeper/puzzle/transitions";
import {
  getMinesweeperVisibleCells,
  type MinesweeperVisibleCell,
} from "@/games/minesweeper/session/session";

/**
 * 遊び方の盤面を、1行を1文字ずつのマスで書いたもの。
 * - `.`: 閉じた、地雷ではないマス
 * - `*`: 閉じた地雷のマス
 * - `o`: 開いたマス（数字は地雷の置き場所から本番の関数で求める）
 * - `x`: 踏んだ地雷
 * - `F`: 旗を置いた地雷のマス
 * - `f`: 旗を置いた、地雷ではないマス
 */
export type MinesweeperHowToPlayFigureRows = readonly string[];

/** 遊び方の盤面。地雷の置き場所と、本番と同じ盤面の状態を持つ。 */
export type MinesweeperExampleBoard = {
  board: MinesweeperBoard;
  puzzle: MinesweeperPuzzleState;
};

/**
 * 例が見せる手1つ。
 * - `reveal`: 閉じたマスを開く。
 * - `flag`: 閉じたマスに旗を置く。
 * - `chord`: 旗の数がそろった数字を押して、周りの残りを開く。
 */
export type MinesweeperExampleMove = {
  cellIndex: number;
  action: "reveal" | "flag" | "chord";
};

/** 閉じたマスを開いたときに起きること。札（✓ / ✕）の答え。 */
export type MinesweeperExampleCandidate = "safe" | "mine";

const mineMarks = new Set(["*", "x", "F"]);

function listMarks(rows: MinesweeperHowToPlayFigureRows): string[] {
  return rows.flatMap((row) => [...row]);
}

function listMarkedCellIndices(
  marks: readonly string[],
  shown: ReadonlySet<string>,
): number[] {
  return marks.flatMap((mark, cellIndex) =>
    shown.has(mark) ? [cellIndex] : [],
  );
}

export function createMinesweeperExampleBoard(
  rows: MinesweeperHowToPlayFigureRows,
): MinesweeperExampleBoard {
  const columns = rows[0]?.length ?? 0;
  if (rows.some((row) => row.length !== columns)) {
    throw new Error("Minesweeper how-to-play rows must have the same length");
  }
  const marks = listMarks(rows);
  const unknownMark = marks.find((mark) => !".*oxFf".includes(mark));
  if (unknownMark !== undefined) {
    throw new Error(`Unknown minesweeper how-to-play mark: ${unknownMark}`);
  }
  return {
    board: {
      rows: rows.length,
      columns,
      mineCellIndices: listMarkedCellIndices(marks, mineMarks),
    },
    puzzle: {
      revealedCellIndices: listMarkedCellIndices(marks, new Set(["o"])),
      flaggedCellIndices: listMarkedCellIndices(marks, new Set(["F", "f"])),
      steppedMineCellIndices: listMarkedCellIndices(marks, new Set(["x"])),
    },
  };
}

export function isMinesweeperExampleCleared(
  example: MinesweeperExampleBoard,
): boolean {
  return isMinesweeperCleared(example.board, example.puzzle);
}

/** 本番と同じ見え方。地雷ではないマスをすべて開いたら、本番と同じく残りの地雷も見せる。 */
export function listMinesweeperExampleVisibleCells(
  example: MinesweeperExampleBoard,
): MinesweeperVisibleCell[] {
  return getMinesweeperVisibleCells(
    example.board,
    example.puzzle,
    isMinesweeperExampleCleared(example),
  );
}

function withPuzzle(
  example: MinesweeperExampleBoard,
  puzzle: MinesweeperPuzzleState,
): MinesweeperExampleBoard {
  return puzzle === example.puzzle ? example : { ...example, puzzle };
}

/** 本番のプレイと同じく、完成した盤面では何も変えない。 */
export function revealMinesweeperExampleCell(
  example: MinesweeperExampleBoard,
  cellIndex: number,
): MinesweeperExampleBoard {
  if (isMinesweeperExampleCleared(example)) {
    return example;
  }
  return withPuzzle(
    example,
    revealMinesweeperCell(example.board, example.puzzle, cellIndex),
  );
}

export function toggleMinesweeperExampleFlag(
  example: MinesweeperExampleBoard,
  cellIndex: number,
): MinesweeperExampleBoard {
  if (isMinesweeperExampleCleared(example)) {
    return example;
  }
  return withPuzzle(
    example,
    toggleMinesweeperFlag(example.board, example.puzzle, cellIndex),
  );
}

export function chordMinesweeperExampleCell(
  example: MinesweeperExampleBoard,
  cellIndex: number,
): MinesweeperExampleBoard {
  if (isMinesweeperExampleCleared(example)) {
    return example;
  }
  return withPuzzle(
    example,
    chordMinesweeperCell(example.board, example.puzzle, cellIndex),
  );
}

/**
 * 閉じたまま見えているマスごとに、開くと何が起きるか（地雷ではない・地雷）。旗を置いたマスは押しても開かないので含めない。
 * 完成した盤面では、残りの地雷を本番の見え方で見せるので、何も返さない。
 */
export function judgeMinesweeperExampleCandidates(
  example: MinesweeperExampleBoard,
): Map<number, MinesweeperExampleCandidate> {
  const candidates = new Map<number, MinesweeperExampleCandidate>();
  listMinesweeperExampleVisibleCells(example).forEach((cell, cellIndex) => {
    if (cell.state === "hidden") {
      candidates.set(
        cellIndex,
        isMinesweeperMine(example.board, cellIndex) ? "mine" : "safe",
      );
    }
  });
  return candidates;
}

function isMoveDone(
  example: MinesweeperExampleBoard,
  { cellIndex, action }: MinesweeperExampleMove,
): boolean {
  const { revealedCellIndices, flaggedCellIndices, steppedMineCellIndices } =
    example.puzzle;
  switch (action) {
    case "reveal":
      return (
        revealedCellIndices.includes(cellIndex) ||
        steppedMineCellIndices.includes(cellIndex)
      );
    case "flag":
      return flaggedCellIndices.includes(cellIndex);
    case "chord":
      return getMinesweeperNeighborCellIndices(example.board, cellIndex).every(
        (neighbor) =>
          revealedCellIndices.includes(neighbor) ||
          flaggedCellIndices.includes(neighbor) ||
          steppedMineCellIndices.includes(neighbor),
      );
  }
}

/** 手を今の盤面で打つと盤面が変わるか。本番の関数で打って確かめる。 */
function isMovePlayable(
  example: MinesweeperExampleBoard,
  { cellIndex, action }: MinesweeperExampleMove,
): boolean {
  switch (action) {
    case "reveal":
      return revealMinesweeperExampleCell(example, cellIndex) !== example;
    case "flag":
      return toggleMinesweeperExampleFlag(example, cellIndex) !== example;
    case "chord":
      return chordMinesweeperExampleCell(example, cellIndex) !== example;
  }
}

/**
 * 例が見せる手のうち、まだ打っていない最初の手。すべて打ったか、盤面が完成していれば `null`。
 * その手を今の盤面では打てない（開いてしまったマスに旗を置く、旗の数がそろわない数字を押す、など）ときも `null` にし、
 * 盤面が変わって打てるようになるまで手がかりを出さない。
 */
export function findMinesweeperExampleNextMove(
  example: MinesweeperExampleBoard,
  moves: readonly MinesweeperExampleMove[],
): MinesweeperExampleMove | null {
  if (isMinesweeperExampleCleared(example)) {
    return null;
  }
  const next = moves.find((move) => !isMoveDone(example, move));
  return next !== undefined && isMovePlayable(example, next) ? next : null;
}

export function isMinesweeperExampleChanged(
  example: MinesweeperExampleBoard,
  initial: MinesweeperExampleBoard,
): boolean {
  const keys = [
    "revealedCellIndices",
    "flaggedCellIndices",
    "steppedMineCellIndices",
  ] as const;
  return keys.some(
    (key) => example.puzzle[key].join() !== initial.puzzle[key].join(),
  );
}

function getDistance(
  board: MinesweeperBoard,
  from: number,
  to: number,
): number {
  return Math.max(
    Math.abs(Math.floor(from / board.columns) - Math.floor(to / board.columns)),
    Math.abs((from % board.columns) - (to % board.columns)),
  );
}

/** 最初から開いていたマスのうち、いちばん近いものまでの距離（斜めも1歩）。 */
function getDistanceFromStart(
  start: MinesweeperExampleBoard,
  cellIndex: number,
): number {
  return Math.min(
    ...start.puzzle.revealedCellIndices.map((revealed) =>
      getDistance(start.board, revealed, cellIndex),
    ),
  );
}

/**
 * ゴールの盤面を開いていく順の姿。開いたマスに続く地雷ではないマスを、最初から開いていたマスに近いものから1つずつ本番の関数で開き
 * （周りに地雷の無いマスは周りも続けて開く）、地雷ではないマスをすべて開くまで並べる。開いた所が始まりの所から外へ広がっていく。
 * 同じ近さのマスは、直前に開いたマスに近いものから開く。最初の姿は含めない。
 */
export function listMinesweeperExampleSolveSteps(
  start: MinesweeperExampleBoard,
): MinesweeperExampleBoard[] {
  const { board } = start;
  const steps: MinesweeperExampleBoard[] = [];
  let current = start;
  let lastOpened = start.puzzle.revealedCellIndices.at(-1) ?? 0;
  while (!isMinesweeperExampleCleared(current)) {
    const revealed = new Set(current.puzzle.revealedCellIndices);
    const from = lastOpened;
    const [next] = Array.from(
      { length: getMinesweeperCellCount(board) },
      (_, cellIndex) => cellIndex,
    )
      .filter(
        (cellIndex) =>
          !revealed.has(cellIndex) &&
          !isMinesweeperMine(board, cellIndex) &&
          getMinesweeperNeighborCellIndices(board, cellIndex).some((neighbor) =>
            revealed.has(neighbor),
          ),
      )
      .sort(
        (left, right) =>
          getDistanceFromStart(start, left) -
            getDistanceFromStart(start, right) ||
          getDistance(board, from, left) - getDistance(board, from, right) ||
          left - right,
      );
    if (next === undefined) {
      throw new Error("Minesweeper goal must open from the revealed cells");
    }
    current = revealMinesweeperExampleCell(current, next);
    steps.push(current);
    lastOpened = next;
  }
  return steps;
}
