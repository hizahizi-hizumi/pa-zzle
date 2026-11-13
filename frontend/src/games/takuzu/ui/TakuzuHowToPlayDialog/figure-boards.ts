import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";

/**
 * 遊び方の図に描く盤面。本番の盤面の一部を、左上を揃えて切り出したものとして扱う。
 * 違反の印は図に書かず、本番の判定から求める。
 * - `rows`: 1文字が1マス。`A` / `B` は最初からある四角 / 丸、`a` / `b` は置いた四角 / 丸、`.` は空き。
 * - `pressedCells`: 押すマス。触れる例では、押す順に並べ、まだ押していない最初のマスに押す所の手がかりを付ける。
 *   押せない図では、次のコマでこのマスを押したことを示す。
 * - `pressDirection`: 触れる例で押す所を押す向き。右クリックで逆に巡る例だけ `backward` にする。
 */
export type TakuzuHowToPlayFigureBoard = {
  rows: readonly string[];
  pressedCells?: readonly number[];
  pressDirection?: TakuzuCycleDirection;
};

/** 例が反するルール。本番の判定の違反の種類に対応する。 */
export type TakuzuHowToPlayViolation = "run" | "overfilled" | "duplicate";

/**
 * ルールの例。触れる例の最初の姿として、できる形・できない形・まだ埋まっていない途中の形を見せる。
 * `violates` は、できない形が反するただ1つのルール。
 */
export type TakuzuHowToPlayRuleExample =
  | {
      board: TakuzuHowToPlayFigureBoard;
      verdict: "allowed" | "incomplete";
    }
  | {
      board: TakuzuHowToPlayFigureBoard;
      verdict: "disallowed";
      violates: TakuzuHowToPlayViolation;
    };

/** 操作の図。前の盤面から順に、`direction` の向きに押した後の盤面を並べる。 */
export type TakuzuHowToPlayOperationFigures = {
  direction: TakuzuCycleDirection;
  steps: readonly TakuzuHowToPlayFigureBoard[];
};

/** 入口に置く、解き終えた盤面の全体。 */
export const goalFigure: TakuzuHowToPlayFigureBoard = {
  rows: [
    "BBaAbAAb",
    "baabbAAb",
    "aBbAabba",
    "AbaaBBab",
    "baBbaabA",
    "BabaAbab",
    "abaBbabA",
    "AAbBaBBa",
  ],
};

/**
 * 最初からある四角・置いた四角・最初からある丸の1行3マス。同じ形の四角を色だけで見分ける。
 * 押す所の手がかりは最初からある四角に付ける。両端が違うタイルなので、置いたマスがどの姿でも3つ続かず、数も超えない。
 */
export const givenTileStrip: TakuzuHowToPlayFigureBoard = {
  rows: ["AaB"],
  pressedCells: [0],
};

/**
 * ルールごとに、左（または上）にできる形、右（または下）にできない形を1つずつ置く。
 * 押す所の手がかりは、押すとそのルールにだけ反する形になる例に付ける。
 * - 3つ続けない: できる形は、丸2つに四角が続く埋まった横の帯で、手がかりの四角を押して丸にすると3つ続く。
 *   できない形は、縦にも続かないことを見せるよう、四角が縦に3つ続く縦の帯にする。
 * - 4つずつ: 四角と丸が4つずつで埋まった行。手がかりの四角を押して丸にすると、丸が5つになる。
 *   ほかの四角は、丸にすると3つ続くので、手がかりを付けない。
 * - 同じ並び: できる形は、埋まった2行が2列だけ違う形で、違う列に見比べる所の印を最初から付ける。
 *   できない形は、上の行の四角を2つ空けた下の行で、空きを左から1回ずつ押すと四角が入って上の行と同じ並びになる。
 *   途中のどの姿でも、3つ続かず、数も超えない。
 */
export const runRuleExamples: readonly TakuzuHowToPlayRuleExample[] = [
  { board: { rows: ["bba"], pressedCells: [2] }, verdict: "allowed" },
  { board: { rows: ["a", "a", "a"] }, verdict: "disallowed", violates: "run" },
];

export const countRuleExamples: readonly TakuzuHowToPlayRuleExample[] = [
  { board: { rows: ["abbaabab"], pressedCells: [4] }, verdict: "allowed" },
  {
    board: { rows: ["aabaabab"] },
    verdict: "disallowed",
    violates: "overfilled",
  },
];

export const duplicateRuleExamples: readonly TakuzuHowToPlayRuleExample[] = [
  { board: { rows: ["abaabbab", "ababbaab"] }, verdict: "allowed" },
  {
    board: { rows: ["abaabbab", "ab.abb.b"], pressedCells: [10, 14] },
    verdict: "incomplete",
  },
];

/**
 * 置き直しに数えるかの例1つ。左から順に押す前の姿を並べ、`pressedCells` に次に押す1つのマスを持つ。
 * 最初の姿の置いたタイルは、空きのマスを押して置いたもの。
 */
export type TakuzuHowToPlayReplacementCountFigure = {
  frames: readonly TakuzuHowToPlayFigureBoard[];
  /** 最後の姿まで押したときに、本番の session が数える置き直しの回数。 */
  correctionCount: number;
};

/**
 * 置き直しに数えるかの例。
 * - `uncounted`: 同じマスを続けて押して丸にする。数えない。
 * - `counted`: 別のマスへ移ってから戻って変える。1回と数える。
 */
export const replacementCountFigures = {
  uncounted: {
    frames: [
      { rows: [".."], pressedCells: [0] },
      { rows: ["a."], pressedCells: [0] },
      { rows: ["b."] },
    ],
    correctionCount: 0,
  },
  counted: {
    frames: [
      { rows: ["a."], pressedCells: [1] },
      { rows: ["aa"], pressedCells: [0] },
      { rows: ["ba"] },
    ],
    correctionCount: 1,
  },
} as const satisfies Record<string, TakuzuHowToPlayReplacementCountFigure>;

const cycleSteps = [{ rows: ["."] }, { rows: ["a"] }, { rows: ["b"] }];

/** 押すたびに巡る順の3つのマス。空き、四角、丸の順で、丸の次は空きへ戻る。 */
export const cycleFigures: TakuzuHowToPlayOperationFigures = {
  direction: "forward",
  steps: cycleSteps,
};

/** 右クリックで巡る順。押すときと同じ3つのマスを、逆の向きに巡る。 */
export const backwardCycleFigures: TakuzuHowToPlayOperationFigures = {
  direction: "backward",
  steps: cycleSteps,
};

/** 巡る順の図の下に置く、本番のマス1つの触れる例。空きから始める。 */
export const cycleTouchBoard: TakuzuHowToPlayFigureBoard = {
  rows: ["."],
  pressedCells: [0],
};

/** 右クリックで巡る順の図の下に置く、本番のマス1つの触れる例。空きから始め、右クリックで押す所を示す。 */
export const backwardCycleTouchBoard: TakuzuHowToPlayFigureBoard = {
  rows: ["."],
  pressedCells: [0],
  pressDirection: "backward",
};
