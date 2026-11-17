import {
  NANPURE_BLOCK_SIZE,
  NANPURE_CELL_COUNT,
  NANPURE_SIZE,
  type NanpureBoard,
  type NanpureDigit,
  type NanpureSolution,
} from "@/games/nanpure/puzzle/board";
import {
  findNanpureConflictCellIndices,
  NANPURE_UNIT_KINDS,
  type NanpureUnitKind,
} from "@/games/nanpure/puzzle/rules";
import type { NanpureNotes } from "@/games/nanpure/session/notes";
import {
  createNanpureSession,
  enterNanpureSessionDigit,
  findNanpureSessionCompletedDigits,
  findNanpureSessionMistakeCellIndices,
  type NanpureSession,
  toggleNanpureSessionNote,
} from "@/games/nanpure/session/session";

/** 例の盤面に見せる、9×9 の盤面の中の範囲。行と列は0始まり。 */
export type NanpureExampleRegion = {
  row: number;
  column: number;
  rowCount: number;
  columnCount: number;
};

/** 空きのマスに書いたメモ。`at` は範囲の中の行と列（0始まり）。 */
type NanpureExampleNote = {
  at: readonly [number, number];
  digits: readonly NanpureDigit[];
};

/**
 * 遊び方の例の盤面。どの例も、チュートリアルと同じ完成した盤面を答えにした 9×9 の盤面の一部を見せる。
 * 見せる範囲の外のマスは空きにするので、範囲の外が判定や印を変えることはない。
 */
export type NanpureHowToPlayBoard = {
  region: NanpureExampleRegion;
  /**
   * 範囲の行ごとの中身。数字は最初からある数字、`+` を前に付けた数字は入れた数字、`.` は空き。空白は読みやすさのために置き、読まない。
   * 最初からある数字は答えと同じにする。入れた数字は答えと違ってもよい。
   */
  rows: readonly string[];
  notes?: readonly NanpureExampleNote[];
};

/** 例で数字を入れたときに鳴らす音の種類。本番のプレイの操作の知らせと同じ。 */
type NanpureExampleSound =
  | "digit-entered"
  | "mistake-entered"
  | "note-added"
  | "note-removed";

type NanpureExampleInputResult = {
  session: NanpureSession;
  /** 盤面が変わらなかったときは `null`。 */
  sound: NanpureExampleSound | null;
};

/** 本番の入力の段で、押せるボタン。 */
export type NanpureExampleInputAvailability = {
  canEnterDigit: boolean;
  canErase: boolean;
  completedDigits: readonly NanpureDigit[];
};

export type NanpureExampleVerdict = "allowed" | "disallowed" | "incomplete";

/** 例の答え。チュートリアルの盤面と同じ完成した盤面にし、遊び方とチュートリアルで同じ数字の並びを見せる。 */
const exampleSolutionRows = [
  "658729314",
  "391456278",
  "724381965",
  "467215893",
  "582937641",
  "139864527",
  "245193786",
  "873642159",
  "916578432",
] as const;

const exampleSolution: NanpureSolution = exampleSolutionRows.flatMap((row) =>
  Array.from(row, (digit) => Number(digit) as NanpureDigit),
);

const tokenPattern = /\+?[1-9]|\./g;

function toCellIndex(row: number, column: number): number {
  return row * NANPURE_SIZE + column;
}

/** 範囲のマスの、9×9 の盤面での番号を、行優先で並べる。 */
export function listNanpureExampleCellIndices({
  row,
  column,
  rowCount,
  columnCount,
}: NanpureExampleRegion): number[] {
  return Array.from({ length: rowCount * columnCount }, (_, offset) =>
    toCellIndex(
      row + Math.floor(offset / columnCount),
      column + (offset % columnCount),
    ),
  );
}

/** 範囲の中の行と列（0始まり）の、9×9 の盤面での番号。 */
export function getNanpureExampleCellIndex(
  region: NanpureExampleRegion,
  [row, column]: readonly [number, number],
): number {
  return toCellIndex(region.row + row, region.column + column);
}

type ParsedExampleCell = {
  cellIndex: number;
  digit: NanpureDigit;
  given: boolean;
};

function parseExampleCells({
  region,
  rows,
}: NanpureHowToPlayBoard): ParsedExampleCell[] {
  return rows.flatMap((text, rowOffset) => {
    const tokens = text.match(tokenPattern) ?? [];
    if (tokens.length !== region.columnCount) {
      throw new RangeError(
        `Nanpure example row must have ${region.columnCount} cells: ${text}`,
      );
    }
    return tokens.flatMap((token, columnOffset) =>
      token === "."
        ? []
        : [
            {
              cellIndex: getNanpureExampleCellIndex(region, [
                rowOffset,
                columnOffset,
              ]),
              digit: Number(token.replace("+", "")) as NanpureDigit,
              given: !token.startsWith("+"),
            },
          ],
    );
  });
}

/**
 * 例の盤面の、本番と同じプレイの状態。最初からある数字を問題の数字にし、入れた数字とメモは本番の session の操作で書き込む。
 * 経過時間と回数は使わない。
 */
export function createNanpureExampleSession(
  definition: NanpureHowToPlayBoard,
): NanpureSession {
  const cells = parseExampleCells(definition);
  const clues: (NanpureDigit | null)[] = Array.from(
    { length: NANPURE_CELL_COUNT },
    () => null,
  );
  for (const { cellIndex, digit, given } of cells) {
    if (given) {
      clues[cellIndex] = digit;
    }
  }
  const started = createNanpureSession({ clues, solution: exampleSolution }, 0);
  const entered = cells
    .filter(({ given }) => !given)
    .reduce(
      (session, { cellIndex, digit }) =>
        enterNanpureSessionDigit(session, cellIndex, digit, 0),
      started,
    );
  return (definition.notes ?? []).reduce(
    (session, { at, digits }) =>
      digits.reduce(
        (withNotes, digit) =>
          toggleNanpureSessionNote(
            withNotes,
            getNanpureExampleCellIndex(definition.region, at),
            digit,
          ),
        session,
      ),
    entered,
  );
}

/**
 * 選んだマスに数字を押したときの、本番のプレイと同じ遷移と音。
 * メモをオンにしているときはメモを書き消しし、オフのときは数字を入れる。入れた数字が答えと違うときはミスの音にする。
 */
export function inputNanpureExampleDigit(
  session: NanpureSession,
  cellIndex: number,
  digit: NanpureDigit,
  notesMode: boolean,
): NanpureExampleInputResult {
  if (notesMode) {
    const next = toggleNanpureSessionNote(session, cellIndex, digit);
    if (next === session) {
      return { session, sound: null };
    }
    return {
      session: next,
      sound: session.notes[cellIndex]?.includes(digit)
        ? "note-removed"
        : "note-added",
    };
  }
  const next = enterNanpureSessionDigit(session, cellIndex, digit, 0);
  if (next === session) {
    return { session, sound: null };
  }
  return {
    session: next,
    sound: findNanpureSessionMistakeCellIndices(next).includes(cellIndex)
      ? "mistake-entered"
      : "digit-entered",
  };
}

/** 本番の入力の段と同じ決まりで、選んだマスに対して押せるボタンを求める。 */
export function getNanpureExampleInputAvailability(
  session: NanpureSession,
  selectedCellIndex: number | null,
  notesMode: boolean,
): NanpureExampleInputAvailability {
  const editable =
    selectedCellIndex !== null &&
    session.problem.clues[selectedCellIndex] === null;
  const hasAnswer =
    selectedCellIndex !== null &&
    session.puzzleState[selectedCellIndex] !== null;
  const hasNotes =
    selectedCellIndex !== null &&
    (session.notes[selectedCellIndex]?.length ?? 0) > 0;
  return {
    canEnterDigit: editable && (!notesMode || !hasAnswer),
    canErase: editable && (hasAnswer || hasNotes),
    completedDigits: findNanpureSessionCompletedDigits(session),
  };
}

/** 本番の盤面と同じく、行・列・ブロックで重なった数字のマスと、答えと違う数字のマス。 */
export function getNanpureExampleMarks(session: NanpureSession): {
  conflictCellIndices: number[];
  mistakeCellIndices: number[];
} {
  return {
    conflictCellIndices: findNanpureConflictCellIndices(session.puzzleState),
    mistakeCellIndices: findNanpureSessionMistakeCellIndices(session),
  };
}

/**
 * 範囲がちょうど1つの行・列・ブロックのとき、そのまとまりの種類。例が教えるルールは、範囲の形で決まる。
 */
function getNanpureExampleUnitKind({
  rowCount,
  columnCount,
}: NanpureExampleRegion): NanpureUnitKind {
  if (rowCount === 1 && columnCount === NANPURE_SIZE) {
    return "row";
  }
  if (columnCount === 1 && rowCount === NANPURE_SIZE) {
    return "column";
  }
  if (rowCount === NANPURE_BLOCK_SIZE && columnCount === NANPURE_BLOCK_SIZE) {
    return "block";
  }
  throw new RangeError(
    "Nanpure example region must be one row, column or block",
  );
}

function findConflictsOfKind(
  board: NanpureBoard,
  kind: NanpureUnitKind,
  cellIndices: readonly number[],
): boolean {
  const conflicts = new Set(findNanpureConflictCellIndices(board, [kind]));
  return cellIndices.some((cellIndex) => conflicts.has(cellIndex));
}

/**
 * 形のルールの例の判定。範囲のまとまりで同じ数字が重なればできない、空きがあれば途中、どれも埋まって重ならなければできる。
 * 埋まる前は、まとまりの数字がそろったとは言えないので、できるとは言わない。
 */
export function judgeNanpureExampleUnit(
  session: NanpureSession,
  region: NanpureExampleRegion,
): NanpureExampleVerdict {
  const cellIndices = listNanpureExampleCellIndices(region);
  const kind = getNanpureExampleUnitKind(region);
  if (findConflictsOfKind(session.puzzleState, kind, cellIndices)) {
    return "disallowed";
  }
  return cellIndices.some(
    (cellIndex) => session.puzzleState[cellIndex] === null,
  )
    ? "incomplete"
    : "allowed";
}

/** 範囲の数字が重なっている行・列・ブロックの種類。 */
export function listNanpureExampleConflictKinds(
  session: NanpureSession,
  region: NanpureExampleRegion,
): NanpureUnitKind[] {
  const cellIndices = listNanpureExampleCellIndices(region);
  return NANPURE_UNIT_KINDS.filter((kind) =>
    findConflictsOfKind(session.puzzleState, kind, cellIndices),
  );
}

/** 範囲のまとまりの種類とは別の種類のまとまりで、範囲の数字が重なっているもの。 */
export function listNanpureExampleOtherConflictKinds(
  session: NanpureSession,
  region: NanpureExampleRegion,
): NanpureUnitKind[] {
  const kind = getNanpureExampleUnitKind(region);
  return listNanpureExampleConflictKinds(session, region).filter(
    (other) => other !== kind,
  );
}

/** 2つの例の盤面の数字とメモが同じか。 */
export function isSameNanpureExampleBoard(
  left: NanpureSession,
  right: NanpureSession,
): boolean {
  return (
    left.puzzleState.every(
      (cell, index) => cell === right.puzzleState[index],
    ) && sameNotes(left.notes, right.notes)
  );
}

function sameNotes(left: NanpureNotes, right: NanpureNotes): boolean {
  return left.every((cellNotes, index) => {
    const other = right[index] ?? [];
    return (
      cellNotes.length === other.length &&
      cellNotes.every((digit, noteIndex) => digit === other[noteIndex])
    );
  });
}

export const _private = { exampleSolution };
