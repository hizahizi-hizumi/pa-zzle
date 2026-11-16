import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  createSolvedSlidePuzzleBoard,
  type SlidePuzzleBoard,
  type SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import type {
  SlidePuzzleHintedExample,
  SlidePuzzleHowToPlayExample,
} from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/example-board";

const solvedBoard = createSolvedSlidePuzzleBoard(3);

/**
 * 入口のゴールの盤面。始まりの盤面から、本番のスライドで1手ずつ並べていき、最後の手で完成する。
 * どの手も空白と同じ行・列のタイルを押す手にし、離れたタイルごとまとめてスライドする手も見せる。
 *
 * ```text
 * 2 3 6   1 2 3
 * _ 1 5   4 5 6
 * 4 7 8   7 8 _
 * ```
 */
export const goalFigure = {
  start: [2, 3, 6, 0, 1, 5, 4, 7, 8],
  tappedTiles: [5, 6, 2, 4, 8],
} as const satisfies {
  start: SlidePuzzleBoard;
  tappedTiles: readonly SlidePuzzleTile[];
};

/**
 * スライドするタイルを見せる盤面。空白を左下の角に置き、同じ行と同じ列に、隣のタイルと離れたタイルが1枚ずつある。
 *
 * ```text
 * 5 1 3
 * 2 8 6
 * _ 4 7
 * ```
 */
const lineBoard: SlidePuzzleBoard = [5, 1, 3, 2, 8, 6, 0, 4, 7];

/** 空白と同じ行・列のタイルだけがスライドするルールの例。手がかりは空白の上の隣のタイルに付ける。 */
export const lineRuleExample: SlidePuzzleHowToPlayExample = {
  board: lineBoard,
  hintTiles: [2],
};

/**
 * 動く枚数のルールの盤面。ルールごとに盤面を変え、空白を右上の角に置いて、同じ行に隣のタイルと離れたタイルを置く。
 *
 * ```text
 * 4 1 _
 * 7 2 3
 * 8 5 6
 * ```
 */
const carryBoard: SlidePuzzleBoard = [4, 1, 0, 7, 2, 3, 8, 5, 6];

/** 動く枚数のルールの対。同じ盤面で、隣のタイルと、同じ行の離れたタイルを押す。 */
export const carryRuleExamples = [
  { board: carryBoard, hintTiles: [1] },
  { board: carryBoard, hintTiles: [4] },
] as const satisfies readonly [
  SlidePuzzleHintedExample,
  SlidePuzzleHintedExample,
];

/**
 * 完成のルールの対。番号の並び順は同じで、空白の場所だけが違う。
 * 完成した盤面には手がかりを付けない。どの手も完成を崩すので、目指す形を崩す手を誘わないため。完成させる手は動かし方の例で見せる。
 *
 * ```text
 * 1 2 3   _ 1 2
 * 4 5 6   3 4 5
 * 7 8 _   6 7 8
 * ```
 */
export const solvedRuleExamples = [
  { board: solvedBoard, hintTiles: [] },
  { board: [0, 1, 2, 3, 4, 5, 6, 7, 8], hintTiles: [] },
] as const satisfies readonly [
  SlidePuzzleHowToPlayExample,
  SlidePuzzleHowToPlayExample,
];

/**
 * 動かし方の例。真ん中の空白へ下の 5 を、続けて右の 8 をスライドさせると完成する。
 *
 * ```text
 * 1 2 3
 * 4 _ 6
 * 7 5 8
 * ```
 */
export const tapOperationExample: SlidePuzzleHowToPlayExample = {
  board: [1, 2, 3, 4, 0, 6, 7, 5, 8],
  hintTiles: [5, 8],
};

/** 手数の流れの図の1コマ。`tappedTile` は、このコマの後に押すタイル。 */
export type SlidePuzzleFlowFrame = {
  board: SlidePuzzleBoard;
  tappedTile: SlidePuzzleTile | null;
};

/** 流れ1つ。押したタイルでスライドした枚数を手数として添える。 */
export type SlidePuzzleMoveCountFlow = {
  frames: readonly [SlidePuzzleFlowFrame, SlidePuzzleFlowFrame];
  movedTileCount: number;
};

function createMoveCountFlow(
  board: SlidePuzzleBoard,
  tappedTile: SlidePuzzleTile,
): SlidePuzzleMoveCountFlow {
  const slide = getSlidePuzzleSlide(board, board.indexOf(tappedTile));
  if (slide === null) {
    throw new Error(`Tile ${tappedTile} does not slide`);
  }
  return {
    frames: [
      { board, tappedTile },
      { board: applySlidePuzzleSlide(board, slide), tappedTile: null },
    ],
    movedTileCount: slide.movedTileIndices.length,
  };
}

/**
 * 手数の流れの始まりの盤面。ルールの例と別の盤面にし、空白を上の真ん中に置いて、同じ列に隣のタイルと離れたタイルを置く。
 *
 * ```text
 * 1 _ 3
 * 4 2 6
 * 7 5 8
 * ```
 */
const moveCountBoard: SlidePuzzleBoard = [1, 0, 3, 4, 2, 6, 7, 5, 8];

/** 手数の数え方の流れ。同じ始まりの盤面で、隣のタイルと、離れたタイルを押す。 */
export const moveCountFlows = {
  adjacent: createMoveCountFlow(moveCountBoard, 2),
  distant: createMoveCountFlow(moveCountBoard, 5),
} as const;
