import type { HowToPlayExampleArrangement } from "@/components/HowToPlayExamplePanel";
import { inputMagicSquareValue } from "@/games/magic-square/play/use-magic-square-play";
import { magicSquareExampleSquares } from "@/games/magic-square/problem/example-squares";
import {
  getMagicSquareLineCellIndices,
  listMagicSquareLines,
  type MagicSquareBoard,
} from "@/games/magic-square/puzzle/board";
import {
  getMagicSquareSessionCorrectionCount,
  type MagicSquareSession,
  selectMagicSquareSessionCell,
} from "@/games/magic-square/session/session";
import type { MagicSquareBoardRegion } from "@/games/magic-square/ui/board/board-layout";
import {
  createMagicSquareExampleSession,
  getMagicSquareExampleCellIndex,
  MAGIC_SQUARE_EXAMPLE_SIZE,
  type MagicSquareHowToPlayBoard,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
import type { MagicSquareExamplePress } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-hint";

/** 例の面に置く、本番の部品。`memo` はメモの切り替え。数の欄はどの例にも置く。 */
export type MagicSquareExampleControl = "memo";

/**
 * 触れる例1つ。面に並べる盤面と、その並べ方と、数の欄のほかに置く本番の部品と、押す所の手がかりの順。
 * 1行だけの盤面は横に長いので、どの例も縦に並べる。
 */
export type MagicSquareHowToPlayExample = {
  boards: readonly MagicSquareHowToPlayBoard[];
  arrangement: HowToPlayExampleArrangement;
  controls: readonly MagicSquareExampleControl[];
  hints: readonly MagicSquareExamplePress[];
};

/** 採点の流れの図1つ。始まりの盤面から、操作ごとの姿を本番の session の関数で求めて並べる。 */
export type MagicSquareHowToPlayFlowFigure = {
  region: MagicSquareBoardRegion;
  frames: readonly MagicSquareSession[];
  /** コマの間の操作の名前。`/` の所で行を分ける。 */
  steps: readonly string[];
  /** 本番の数え方で、最後のコマまでに数えた置き直しの回数。 */
  correctionCount: number;
};

const firstRow: MagicSquareBoardRegion = {
  row: 0,
  column: 0,
  rowCount: 1,
  columnCount: MAGIC_SQUARE_EXAMPLE_SIZE,
};

const wholeBoard: MagicSquareBoardRegion = {
  row: 0,
  column: 0,
  rowCount: MAGIC_SQUARE_EXAMPLE_SIZE,
  columnCount: MAGIC_SQUARE_EXAMPLE_SIZE,
};

/** 1行だけの例の、2行目からの空き。 */
const emptyRows = [". . . .", ". . . .", ". . . ."] as const;

function onFirstRow(row: string, memos?: MagicSquareHowToPlayBoard["memos"]) {
  return {
    region: firstRow,
    rows: [row, ...emptyRows],
    ...(memos && { memos }),
  } satisfies MagicSquareHowToPlayBoard;
}

function cellAt(
  board: number,
  at: readonly [number, number],
): MagicSquareExamplePress {
  return { kind: "cell", board, cellIndex: getMagicSquareExampleCellIndex(at) };
}

function value(entered: number): MagicSquareExamplePress {
  return { kind: "value", value: entered };
}

/**
 * 列の合計のルールの対。上は答えの魔方陣の1行目どおりに34にそろった形、下は空きがあるのに合計に届いた形。
 * そろった形の手がかりは、右端の数を別の数に置き換えて、埋まったまま合計と違う形にする手にする。
 */
export const lineRuleExample: MagicSquareHowToPlayExample = {
  boards: [onFirstRow("+14 +4 +5 +11"), onFirstRow("+14 +4 . +16")],
  arrangement: "stacked",
  controls: [],
  hints: [cellAt(0, [0, 3]), value(13)],
};

/**
 * 数を1回ずつ使うルール。置いた数は数の欄でくぼみに変わって押せなくなるので、くぼみの数に ✕ を付ける。
 * 手がかりは、空いたマスに残りの数を置いて、その数もくぼみに変わる手にする。
 */
export const usedValueRuleExample: MagicSquareHowToPlayExample = {
  boards: [onFirstRow("+14 +4 +5 .")],
  arrangement: "stacked",
  controls: [],
  hints: [cellAt(0, [0, 3]), value(11)],
};

/**
 * 最初から置いてある数（左の2つ）と置いた数と空きを混ぜた行。数のあるマスごとに、変えられるかの印を付ける。
 * 手がかりは、最初から置いてある数を選んで別の数を押し、受け付けられない手にする。
 */
export const givenRuleExample: MagicSquareHowToPlayExample = {
  boards: [onFirstRow("14 4 +5 .")],
  arrangement: "stacked",
  controls: [],
  hints: [cellAt(0, [0, 0]), value(6)],
};

/**
 * 盤面の全体。左上からの斜めの上で、横と縦の列の最後の空きのマスを選んで、答えの数を置く。
 * もう1つ空きを残し、例の中で解き終えないようにする。
 */
export const placeOperationExample: MagicSquareHowToPlayExample = {
  boards: [
    {
      region: wholeBoard,
      rows: ["14 +4 +5 11", "9 . 7 16", "8 +13 . 1", "+3 15 +10 +6"],
    },
  ],
  arrangement: "stacked",
  controls: [],
  hints: [cellAt(0, [1, 1]), value(2)],
};

/** 置いた数を、別の数に置き換えてから、同じ数をもう一度押して外す。空きを残し、どの手でも列を埋めない。 */
export const replaceOperationExample: MagicSquareHowToPlayExample = {
  boards: [onFirstRow("+14 +4 . +9")],
  arrangement: "stacked",
  controls: [],
  hints: [cellAt(0, [0, 3]), value(11), value(11)],
};

/** 空いたマスに、メモに切り替えて数を書いてから、同じ数をもう一度押して消す。 */
export const memoOperationExample: MagicSquareHowToPlayExample = {
  boards: [onFirstRow("+14 +4 . .")],
  arrangement: "stacked",
  controls: ["memo"],
  hints: [cellAt(0, [0, 2]), { kind: "memo" }, value(5), value(5)],
};

/** 空いた2つのマスのどちらにも5のメモがあり、1つのマスに5を置くと、もう1つのマスのメモから5が消える。 */
export const memoClearedOperationExample: MagicSquareHowToPlayExample = {
  boards: [
    onFirstRow("+14 +4 . .", [
      { at: [0, 2], values: [5, 11] },
      { at: [0, 3], values: [5, 11] },
    ]),
  ],
  arrangement: "stacked",
  controls: [],
  hints: [cellAt(0, [0, 2]), value(5)],
};

/**
 * 入口のゴールの答え。チュートリアルと同じ、問題集から除く 4×4 の例の魔方陣。
 * 最初から置いてある数は、レベル1の問題ともチュートリアルの盤面とも違う並びにし、どちらの問題も見せないようにする。
 * 1マスだけ空いた列をたどれば解き切れる。
 */
const goalAnswer = magicSquareExampleSquares[4];
const goalGivenCells = new Set([0, 3, 4, 6, 7, 8, 11, 13]);

export const goalBoard = {
  givens: {
    size: MAGIC_SQUARE_EXAMPLE_SIZE,
    cells: goalAnswer.map((cell, cellIndex) =>
      goalGivenCells.has(cellIndex) ? cell : null,
    ),
  } satisfies MagicSquareBoard,
  answer: {
    size: MAGIC_SQUARE_EXAMPLE_SIZE,
    cells: [...goalAnswer],
  } satisfies MagicSquareBoard,
};

/** 1マスだけ空いた列を、列の並び（行・縦・斜め）の順に探して埋めていく順。ゴールの盤面を埋める順にする。 */
export function listMagicSquareReadingOrder(
  givens: MagicSquareBoard,
): number[] {
  const filled = new Set(
    givens.cells.flatMap((cell, cellIndex) =>
      cell === null ? [] : [cellIndex],
    ),
  );
  const lines = listMagicSquareLines(givens.size).map((line) =>
    getMagicSquareLineCellIndices(givens.size, line),
  );
  const order: number[] = [];
  for (;;) {
    const line = lines.find(
      (cellIndices) =>
        cellIndices.filter((cellIndex) => !filled.has(cellIndex)).length === 1,
    );
    const next = line?.find((cellIndex) => !filled.has(cellIndex));
    if (next === undefined) {
      return order;
    }
    filled.add(next);
    order.push(next);
  }
}

/** 採点の流れの図の、1行目の右端のマスと行の合計。 */
const flowRegion: MagicSquareBoardRegion = {
  row: 0,
  column: MAGIC_SQUARE_EXAMPLE_SIZE - 1,
  rowCount: 1,
  columnCount: 1,
};
const flowCell = getMagicSquareExampleCellIndex([0, 3]);

/** 流れの始まり。1行目の右端だけが空き、そのマスを選んだ姿。 */
const flowStart = selectMagicSquareSessionCell(
  createMagicSquareExampleSession(onFirstRow("+14 +4 +5 .")),
  flowCell,
);

function enter(session: MagicSquareSession, entered: number) {
  return inputMagicSquareValue(session, "value", entered, 0).session;
}

function createFlow(
  steps: readonly [number, number],
  stepNames: readonly [string, string],
): MagicSquareHowToPlayFlowFigure {
  const placed = enter(flowStart, steps[0]);
  const corrected = enter(placed, steps[1]);
  return {
    region: flowRegion,
    frames: [flowStart, placed, corrected],
    steps: stepNames,
    correctionCount: getMagicSquareSessionCorrectionCount(corrected),
  };
}

/**
 * 置き直しの数え方の流れ。どちらも1行目の最後の空きに数を置き、列が埋まって列の端の数が違反の色になったのを、同じマスで 11 に直す。
 * 9 から直すと数え、数の欄で隣り合う 12 から直すと押し間違いの直しとして数えない。
 */
export const correctionCountFlows = {
  changed: createFlow([9, 11], ["9を/置く", "11に/置き/換える"]),
  mistyped: createFlow([12, 11], ["12を/置く", "11に/置き/換える"]),
} as const satisfies Record<string, MagicSquareHowToPlayFlowFigure>;
