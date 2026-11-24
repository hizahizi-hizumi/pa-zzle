import type {
  MagicSquareBoard,
  MagicSquareCell,
} from "@/games/magic-square/puzzle/board";
import {
  evaluateMagicSquareLine,
  isMagicSquareGivenCell,
  type MagicSquareLineStatus,
} from "@/games/magic-square/puzzle/rules";
import { isSameMagicSquareState } from "@/games/magic-square/puzzle/state";
import {
  createMagicSquareSession,
  enterMagicSquareSessionValue,
  type MagicSquareSession,
  selectMagicSquareSessionCell,
  toggleMagicSquareSessionMemo,
} from "@/games/magic-square/session/session";
import type { MagicSquareBoardRegion } from "@/games/magic-square/ui/board/board-layout";
import { magicSquareLineStatusPhrases } from "@/games/magic-square/ui/board/MagicSquareBoard";

/** 例の盤面の一辺。どの例も、レベル1と同じ 4×4 の盤面か、その一部を見せる。 */
export const MAGIC_SQUARE_EXAMPLE_SIZE = 4;

/** 空きのマスに書いたメモ。`at` は盤面の行と列（0始まり）。 */
type MagicSquareExampleMemo = {
  at: readonly [number, number];
  values: readonly number[];
};

/**
 * 遊び方の例の盤面。4×4 の盤面のうち `region` の範囲を見せる。範囲の外のマスは空きにして、判定や印を変えないようにする。
 */
export type MagicSquareHowToPlayBoard = {
  region: MagicSquareBoardRegion;
  /**
   * 行ごとの中身。数は最初から置いてある数、`+` を前に付けた数は置いた数、`.` は空き。空白で区切る。
   * 最初から置いてある数だけでは違反の列が無いようにする（本番の問題と同じ）。
   */
  rows: readonly string[];
  memos?: readonly MagicSquareExampleMemo[];
};

/**
 * 触れる例の判定。
 * - `allowed`: できる（✓）。
 * - `disallowed`: できない（✕）。
 * - `incomplete`: 形のルールで、列が埋まらず違反も無い途中の姿。
 */
export type MagicSquareExampleVerdict = "allowed" | "disallowed" | "incomplete";

type ParsedExampleCell = {
  cellIndex: number;
  value: number;
  given: boolean;
};

function toCellIndex(row: number, column: number): number {
  return row * MAGIC_SQUARE_EXAMPLE_SIZE + column;
}

function parseExampleCells(rows: readonly string[]): ParsedExampleCell[] {
  if (rows.length !== MAGIC_SQUARE_EXAMPLE_SIZE) {
    throw new RangeError(
      `Magic square example must have ${MAGIC_SQUARE_EXAMPLE_SIZE} rows`,
    );
  }
  return rows.flatMap((text, row) => {
    const tokens = text.trim().split(/\s+/);
    if (tokens.length !== MAGIC_SQUARE_EXAMPLE_SIZE) {
      throw new RangeError(
        `Magic square example row must have ${MAGIC_SQUARE_EXAMPLE_SIZE} cells: ${text}`,
      );
    }
    return tokens.flatMap((token, column) =>
      token === "."
        ? []
        : [
            {
              cellIndex: toCellIndex(row, column),
              value: Number(token.replace("+", "")),
              given: !token.startsWith("+"),
            },
          ],
    );
  });
}

function createGivens(cells: readonly ParsedExampleCell[]): MagicSquareBoard {
  const board: MagicSquareCell[] = Array.from(
    { length: MAGIC_SQUARE_EXAMPLE_SIZE ** 2 },
    () => null,
  );
  for (const { cellIndex, value, given } of cells) {
    if (given) {
      board[cellIndex] = value;
    }
  }
  return { size: MAGIC_SQUARE_EXAMPLE_SIZE, cells: board };
}

/**
 * 例の盤面の、本番と同じプレイの状態。最初から置いてある数を問題にし、置いた数とメモは本番の session の操作で書き込む。
 * 書き込んだ後の盤面を例の始まりにするので、待ったで戻せる盤面操作と、置き直しの回数と変えている途中のマスの記録は持たない。
 * 経過時間は使わない。どのマスも選んでいない姿にする。
 */
export function createMagicSquareExampleSession({
  rows,
  memos = [],
}: MagicSquareHowToPlayBoard): MagicSquareSession {
  const cells = parseExampleCells(rows);
  const started = createMagicSquareSession({ givens: createGivens(cells) }, 0);
  const placed = cells
    .filter(({ given }) => !given)
    .reduce(
      (session, { cellIndex, value }) =>
        enterMagicSquareSessionValue(
          selectMagicSquareSessionCell(session, cellIndex),
          value,
          0,
        ),
      started,
    );
  const written = memos.reduce(
    (session, { at: [row, column], values }) =>
      values.reduce(
        (withMemo, value) =>
          toggleMagicSquareSessionMemo(
            selectMagicSquareSessionCell(withMemo, toCellIndex(row, column)),
            value,
            0,
          ),
        session,
      ),
    placed,
  );
  return {
    ...written,
    selectedCellIndex: null,
    history: [],
    correctionCount: 0,
    editingCell: null,
  };
}

/** 盤面の行と列（0始まり）のマスの番号。 */
export function getMagicSquareExampleCellIndex([row, column]: readonly [
  number,
  number,
]): number {
  return toCellIndex(row, column);
}

export function isSameMagicSquareExampleBoard(
  left: MagicSquareSession,
  right: MagicSquareSession,
): boolean {
  return isSameMagicSquareState(left.puzzleState, right.puzzleState);
}

const lineVerdicts = {
  incomplete: "incomplete",
  matched: "allowed",
  unmatched: "disallowed",
  overreached: "disallowed",
} as const satisfies Record<MagicSquareLineStatus, MagicSquareExampleVerdict>;

/** 例の範囲の1行目の列の判定と、✕ のわけ。わけは、本番の盤面が読み上げで言う列の状態の言葉にする。 */
export function judgeMagicSquareExampleRow(
  session: MagicSquareSession,
  region: MagicSquareBoardRegion,
): { verdict: MagicSquareExampleVerdict; reason: string | null } {
  const { status } = evaluateMagicSquareLine(session.puzzleState, {
    kind: "row",
    index: region.row,
  });
  const verdict = lineVerdicts[status];
  return {
    verdict,
    reason:
      verdict === "disallowed" ? magicSquareLineStatusPhrases[status] : null,
  };
}

/** マスの数を変えられるか。最初から置いてある数は変えられず、置いた数は変えられる。空きのマスは `null`。 */
export function judgeMagicSquareExampleCell(
  session: MagicSquareSession,
  cellIndex: number,
): Exclude<MagicSquareExampleVerdict, "incomplete"> | null {
  if (session.puzzleState.cells[cellIndex] === null) {
    return null;
  }
  return isMagicSquareGivenCell(session.problem.givens, cellIndex)
    ? "disallowed"
    : "allowed";
}
