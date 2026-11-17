import type { HowToPlayExampleArrangement } from "@/components/HowToPlayExamplePanel";
import type { NanpureDigit } from "@/games/nanpure/puzzle/board";
import {
  type NanpureSession,
  undoNanpureSession,
} from "@/games/nanpure/session/session";
import {
  createNanpureExampleSession,
  getNanpureExampleCellIndex,
  inputNanpureExampleDigit,
  type NanpureExampleRegion,
  type NanpureHowToPlayBoard,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import type { NanpureExamplePress } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-hint";
import { PLAY_OPERATION_PHRASES } from "@/games/play-vocabulary";

/** 例の面に置く、本番の入力の段のボタン。 */
export type NanpureExampleControl = "digits" | "erase" | "notes";

/**
 * 触れる例1つ。面に並べる盤面と、その並べ方と、本番の入力の段から例に要るボタンと、押す所の手がかりの順。
 * 並べ方は例を並べる面に渡す。縦に長い列やブロックの対は横に、横に長い行の対や1つだけの盤面は縦に並べる。
 */
export type NanpureHowToPlayExample = {
  boards: readonly NanpureHowToPlayBoard[];
  arrangement: HowToPlayExampleArrangement;
  controls: readonly NanpureExampleControl[];
  hints: readonly NanpureExamplePress[];
};

/** 採点の流れの図1つ。始まりの盤面から、操作ごとの姿を本番の session の関数で求めて並べる。 */
export type NanpureHowToPlayFlowFigure = {
  region: NanpureExampleRegion;
  frames: readonly NanpureSession[];
  /** コマの間の操作の名前。`/` の所で行を分ける。 */
  steps: readonly string[];
};

const firstRow: NanpureExampleRegion = {
  row: 0,
  column: 0,
  rowCount: 1,
  columnCount: 9,
};
const firstColumn: NanpureExampleRegion = {
  row: 0,
  column: 0,
  rowCount: 9,
  columnCount: 1,
};
const firstBlock: NanpureExampleRegion = {
  row: 0,
  column: 0,
  rowCount: 3,
  columnCount: 3,
};
const wholeBoard: NanpureExampleRegion = {
  row: 0,
  column: 0,
  rowCount: 9,
  columnCount: 9,
};

function cellAt(
  board: number,
  region: NanpureExampleRegion,
  at: readonly [number, number],
): NanpureExamplePress {
  return {
    kind: "cell",
    board,
    cellIndex: getNanpureExampleCellIndex(region, at),
  };
}

function digit(value: NanpureDigit): NanpureExamplePress {
  return { kind: "digit", digit: value };
}

/**
 * 形のルールの対。左（上）はどれも埋まって重ならない形、右（下）は同じ数字が2つある形。
 * できる形の手がかりは、入れた数字を、そのまとまりのほかの所にある数字へ入れ替える手にする。
 * 入れ替える2つのマスは、例が教えるまとまりのほかでは同じ行・列・ブロックに入らないようにし、別のルールの重なりを起こさない。
 */
export const rowRuleExample: NanpureHowToPlayExample = {
  boards: [
    { region: firstRow, rows: ["6 5 +8 7 +2 9 3 +1 4"] },
    { region: firstRow, rows: ["6 5 +8 7 +2 9 3 +1 +6"] },
  ],
  arrangement: "stacked",
  controls: ["digits"],
  hints: [cellAt(0, firstRow, [0, 4]), digit(6)],
};

export const columnRuleExample: NanpureHowToPlayExample = {
  boards: [
    {
      region: firstColumn,
      rows: ["6", "+3", "7", "4", "+5", "1", "+2", "8", "9"],
    },
    {
      region: firstColumn,
      rows: ["6", "+3", "7", "4", "+5", "1", "+2", "8", "+6"],
    },
  ],
  arrangement: "side-by-side",
  controls: ["digits"],
  hints: [cellAt(0, firstColumn, [6, 0]), digit(3)],
};

export const blockRuleExample: NanpureHowToPlayExample = {
  boards: [
    { region: firstBlock, rows: ["6 5 8", "3 +9 1", "+7 2 +4"] },
    { region: firstBlock, rows: ["6 5 8", "3 +9 1", "+7 2 +5"] },
  ],
  arrangement: "side-by-side",
  controls: ["digits"],
  hints: [cellAt(0, firstBlock, [2, 2]), digit(6)],
};

/** 最初からある数字と入れた数字を混ぜたブロック。手がかりは、最初からある数字を選ぶ手。 */
export const givenRuleExample: NanpureHowToPlayExample = {
  boards: [{ region: firstBlock, rows: ["6 +5 8", "3 9 +1", "7 +2 4"] }],
  arrangement: "stacked",
  controls: ["digits"],
  hints: [cellAt(0, firstBlock, [0, 0])],
};

/** ブロックに1つだけある空きのマスを選んで、盤面から1つに決まる答えの数字を入れる。 */
export const enterOperationExample: NanpureHowToPlayExample = {
  boards: [{ region: firstBlock, rows: ["6 5 +8", "3 . 1", "+7 2 4"] }],
  arrangement: "stacked",
  controls: ["digits"],
  hints: [cellAt(0, firstBlock, [1, 1]), digit(9)],
};

/**
 * 入れた数字のマスを選んで、別の数字に入れ替える。入れてある数字は答えと違い、ブロックのもう1つの空きの答えなので、
 * ブロックの中では重ならずに赤い。入れ替える数字は、ブロックで足りない数字のうち、そのマスの答えにする。
 */
export const replaceOperationExample: NanpureHowToPlayExample = {
  boards: [{ region: firstBlock, rows: ["6 5 8", "3 +4 1", "7 2 ."] }],
  arrangement: "stacked",
  controls: ["digits"],
  hints: [cellAt(0, firstBlock, [1, 1]), digit(9)],
};

/**
 * 空きのマスに、答えと違う数字を入れる。入れる数字はブロックのもう1つの空きの答えにし、ブロックの中で重ならないようにして、
 * 赤くなるわけが、答えと違うことだけになるようにする。
 */
export const mistakeAssistExample: NanpureHowToPlayExample = {
  boards: [{ region: firstBlock, rows: ["6 . 8", "3 . 1", "7 2 4"] }],
  arrangement: "stacked",
  controls: ["digits"],
  hints: [cellAt(0, firstBlock, [0, 1]), digit(9)],
};

/** 5が答えの位置に8つあり、残り1つの空きに5を入れると9つそろう盤面。ほかの数字は置かず、5だけを見せる。 */
export const completedDigitAssistExample: NanpureHowToPlayExample = {
  boards: [
    {
      region: wholeBoard,
      rows: [
        ". 5 . . . . . . .",
        ". . . . 5 . . . .",
        ". . . . . . . . 5",
        ". . . . . 5 . . .",
        "5 . . . . . . . .",
        ". . . . . . . . .",
        ". . 5 . . . . . .",
        ". . . . . . . 5 .",
        ". . . 5 . . . . .",
      ],
    },
  ],
  arrangement: "stacked",
  controls: ["digits"],
  hints: [cellAt(0, wholeBoard, [5, 6]), digit(5)],
};

/** 入れた数字のマスを選んで消す。 */
export const eraseOperationExample: NanpureHowToPlayExample = {
  boards: [{ region: firstBlock, rows: ["6 5 8", "3 +9 1", "7 2 +4"] }],
  arrangement: "stacked",
  controls: ["erase"],
  hints: [cellAt(0, firstBlock, [1, 1]), { kind: "erase" }],
};

/** メモを書いた空きのマスに、メモをオンにして、新しい数字を書いてから、同じ数字をもう一度押して消す。 */
export const notesOperationExample: NanpureHowToPlayExample = {
  boards: [
    {
      region: firstBlock,
      rows: ["6 . 8", ". 9 .", "7 2 ."],
      notes: [{ at: [0, 1], digits: [1, 3] }],
    },
  ],
  arrangement: "stacked",
  controls: ["notes", "digits"],
  hints: [cellAt(0, firstBlock, [0, 1]), { kind: "notes" }, digit(4), digit(4)],
};

/** 空きのマスのどれにも5のメモがあり、1つのマスに5を入れると、ほかのマスのメモから5が消える。 */
export const notesClearedAssistExample: NanpureHowToPlayExample = {
  boards: [
    {
      region: firstBlock,
      rows: ["6 . 8", ". 9 .", "7 2 ."],
      notes: [
        { at: [0, 1], digits: [1, 5] },
        { at: [1, 0], digits: [3, 5] },
        { at: [1, 2], digits: [1, 4, 5] },
        { at: [2, 2], digits: [4, 5] },
      ],
    },
  ],
  arrangement: "stacked",
  controls: ["digits"],
  hints: [cellAt(0, firstBlock, [0, 1]), digit(5)],
};

/** 入口の盤面。チュートリアルと同じ答えから、点対称に最初からある数字を残す。 */
export const goalBoard: NanpureHowToPlayBoard = {
  region: wholeBoard,
  rows: [
    "6 . 8 7 . . . 1 .",
    ". 9 . . 5 . . . 8",
    "7 . . 3 . 1 9 . .",
    ". 6 7 . . 5 . 9 .",
    "5 . . . 3 . . . 1",
    ". 3 . 8 . . 5 2 .",
    ". . 5 1 . 3 . . 6",
    "8 . . . 4 . . 5 .",
    ". 1 . . . 8 4 . 2",
  ],
};

/** ミスを数える流れの、1つの空きのマス。答えは5。 */
const mistakeFlowRegion: NanpureExampleRegion = {
  row: 0,
  column: 1,
  rowCount: 1,
  columnCount: 1,
};
const mistakeFlowCell = getNanpureExampleCellIndex(mistakeFlowRegion, [0, 0]);

function enter(session: NanpureSession, value: NanpureDigit): NanpureSession {
  return inputNanpureExampleDigit(session, mistakeFlowCell, value, false)
    .session;
}

const mistakeFlowStart = createNanpureExampleSession({
  region: mistakeFlowRegion,
  rows: ["."],
});
const mistakeEntered = enter(mistakeFlowStart, 9);

/** 答えと違う数字を入れてから取り消す流れと、正しい数字に入れ替える流れ。どちらも入れた時に数えたミスは減らない。 */
export const mistakeCountFlows = {
  undo: {
    region: mistakeFlowRegion,
    frames: [
      mistakeFlowStart,
      mistakeEntered,
      undoNanpureSession(mistakeEntered),
    ],
    steps: ["9を/入れる", PLAY_OPERATION_PHRASES.undo],
  },
  replace: {
    region: mistakeFlowRegion,
    frames: [mistakeFlowStart, mistakeEntered, enter(mistakeEntered, 5)],
    steps: ["9を/入れる", "5を/入れる"],
  },
} as const satisfies Record<string, NanpureHowToPlayFlowFigure>;
