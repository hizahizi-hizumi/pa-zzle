import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  listSlidePuzzleSingleMoves,
  type SlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  calculateSlidePuzzleManhattanDistance,
  createSolvedSlidePuzzleBoard,
  findSlidePuzzleBlankIndex,
  isSlidePuzzleSolved,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard,
  type SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/**
 * - `slide`: 空白の隣のタイルは、空白にスライドする。
 * - `line`: 空白と同じ行・列のタイルは、離れていても間のタイルとまとめてスライドする。同じ行・列にないタイルはスライドしない。
 */
export type SlidePuzzleTutorialRuleId = "slide" | "line";

/** 盤面と同じく、タイルのあるマスをタップする。 */
export type SlidePuzzleTutorialAction = { cellIndex: number };

/**
 * - `tile`: 印を付け、手順の間だけタップを受け付けるタイル。スライドさせると次の手順へ進む。
 *   どの手順のタイルも、スライドさせると動いたタイルがすべて自分の場所に収まる。
 */
export type SlidePuzzleTutorialStep =
  TutorialStep<SlidePuzzleTutorialRuleId> & {
    tile: SlidePuzzleTile;
  };

/**
 * 直前の手。盤面の上の合図に使う。
 * - `slid`: スライドした。`landedTiles` は、この手で自分の場所に収まったタイル。
 * - `rejected`: 同じ行・列のルールを示した後に、空白と同じ行・列にないタイルをタップし、スライドしなかった。
 */
export type SlidePuzzleTutorialMove =
  | {
      type: "slid";
      slide: SlidePuzzleSlide;
      landedTiles: readonly SlidePuzzleTile[];
    }
  | { type: "rejected"; tile: SlidePuzzleTile; cellIndex: number };

/** `moveCount`: 盤面に反応した手の数。同じタイルへの合図をやり直す目印に使う。 */
export type SlidePuzzleTutorialBoardState = {
  board: SlidePuzzleBoard;
  moveCount: number;
  lastMove: SlidePuzzleTutorialMove | null;
};

type SlidePuzzleTutorialSituation = TutorialSituation<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialStep
>;

/**
 * 8枚すべてが崩れ、空白が真ん中から始まる。空白を自分の場所とするタイルが、いつも空白の隣にあり、
 * それをスライドさせるたびに1枚ずつ自分の場所に収まるので、遠回りせずに8手で完成する。最短の解き方はこの1通りだけ。
 *
 * ```text
 * 最初    ゴール
 * 4 1 2   1 2 3
 * 7 _ 3   4 5 6
 * 8 5 6   7 8 _
 * ```
 */
const startBoard: SlidePuzzleBoard = [4, 1, 2, 7, 0, 3, 8, 5, 6];
const goalBoard = createSolvedSlidePuzzleBoard(3);

/**
 * 5 を下から、8 を左から1枚ずつ収め、左の列の 7 と 4 をまとめて収める。7 は隣にあり1枚でも収まるが、4 なら 7 もスライドして2枚が一度に収まる。
 * 手順を終えると、空白が左上に来て、上の行の 1・2 と右の列の 3・6 が残る。どちらも行・列ごとまとめても収められる。
 */
const steps: readonly SlidePuzzleTutorialStep[] = [
  {
    message: {
      headline: "空白の隣のタイルは\nタップするとスライドします",
      detail: "印のタイルをタップしてください",
    },
    introducedRuleId: "slide",
    tile: 5,
  },
  {
    message: {
      headline: "この空白には 8 が収まります",
      detail: null,
    },
    introducedRuleId: null,
    tile: 8,
  },
  {
    message: {
      headline: "空白と同じ行・列なら\n離れたタイルもスライドします",
      detail: "4 をタップすると 7 もスライドします",
    },
    introducedRuleId: "line",
    tile: 4,
  },
];

/** 空白を自分の場所とするタイル。空白が右下にあるときは無い。 */
function getTileForBlank(board: SlidePuzzleBoard): SlidePuzzleTile | null {
  const blankIndex = findSlidePuzzleBlankIndex(board);
  return blankIndex === board.length - 1 ? null : blankIndex + 1;
}

function isAtGoal(tile: SlidePuzzleTile, cellIndex: number): boolean {
  return tile === cellIndex + 1;
}

function listLandedTiles(
  board: SlidePuzzleBoard,
  slide: SlidePuzzleSlide,
): SlidePuzzleTile[] {
  const blankIndex = findSlidePuzzleBlankIndex(board);
  return slide.movedTileIndices.flatMap((cellIndex, order) => {
    const tile = board[cellIndex];
    const movedTo =
      order === 0 ? blankIndex : (slide.movedTileIndices[order - 1] ?? -1);
    return tile !== undefined && isAtGoal(tile, movedTo) ? [tile] : [];
  });
}

/**
 * 空白を自分の場所とするタイルを、空白と同じ行・列にある間スライドさせて収め続けた盤面の並び。始めの盤面から始まる。
 * 手に入れたルールを当てはめるだけの読みで、どこまで進めるかを確かめるのに使う。
 */
function listBoardsByReading(
  board: SlidePuzzleBoard,
): readonly SlidePuzzleBoard[] {
  const boards = [board];
  let current = board;
  for (;;) {
    const tile = getTileForBlank(current);
    const slide =
      tile === null
        ? null
        : getSlidePuzzleSlide(current, current.indexOf(tile));
    if (!slide) {
      return boards;
    }
    current = applySlidePuzzleSlide(current, slide);
    boards.push(current);
  }
}

/**
 * 今の盤面から最短で完成させるときに、次にスライドさせる空白の隣のタイルのマス。完成していれば `null`。
 * 3×3 の盤面は、タイルと自分の場所との距離の和を下限にした反復深化で、どこからでもすぐ求まる。
 */
function findNextShortestMoveCellIndex(board: SlidePuzzleBoard): number | null {
  if (isSlidePuzzleSolved(board)) {
    return null;
  }

  function search(
    current: SlidePuzzleBoard,
    depth: number,
    bound: number,
    previousBlankIndex: number,
  ): number | "found" {
    const estimate = depth + calculateSlidePuzzleManhattanDistance(current);
    if (estimate > bound) {
      return estimate;
    }
    if (isSlidePuzzleSolved(current)) {
      return "found";
    }
    let nextBound = Number.POSITIVE_INFINITY;
    for (const cellIndex of listSlidePuzzleSingleMoves(current)) {
      if (cellIndex === previousBlankIndex) {
        continue;
      }
      const slide = getSlidePuzzleSlide(current, cellIndex);
      if (!slide) {
        continue;
      }
      const result = search(
        applySlidePuzzleSlide(current, slide),
        depth + 1,
        bound,
        findSlidePuzzleBlankIndex(current),
      );
      if (result === "found") {
        firstMoves[depth] = cellIndex;
        return "found";
      }
      nextBound = Math.min(nextBound, result);
    }
    return nextBound;
  }

  const firstMoves: number[] = [];
  let bound = calculateSlidePuzzleManhattanDistance(board);
  for (;;) {
    const result = search(board, 0, bound, -1);
    if (result === "found") {
      return firstMoves[0] ?? null;
    }
    bound = result;
  }
}

function startSlidePuzzleTutorial(): SlidePuzzleTutorialBoardState {
  return { board: startBoard, moveCount: 0, lastMove: null };
}

function getSlidePuzzleTutorialGoal(): SlidePuzzleTutorialBoardState {
  return { board: goalBoard, moveCount: 0, lastMove: null };
}

/**
 * 手を引いている間は、印のタイルだけをスライドさせる。手を離した後は本番と同じく、空白と同じ行・列のタイルはスライドする。
 * 空白と同じ行・列にないタイルは、同じ行・列のルールを示した後なら、手を引いている間も本番と同じくルールに合わない手として返す。
 */
function performSlidePuzzleTutorialAction(
  { step, earnedRuleIds }: SlidePuzzleTutorialSituation,
  state: SlidePuzzleTutorialBoardState,
  { cellIndex }: SlidePuzzleTutorialAction,
): { state: SlidePuzzleTutorialBoardState; outcome: TutorialMoveOutcome } {
  const tile = state.board[cellIndex];
  if (tile === undefined || tile === SLIDE_PUZZLE_BLANK) {
    return { state, outcome: "ignored" };
  }

  const slide = getSlidePuzzleSlide(state.board, cellIndex);
  if (!slide) {
    return earnedRuleIds.includes("line")
      ? {
          state: {
            ...state,
            moveCount: state.moveCount + 1,
            lastMove: { type: "rejected", tile, cellIndex },
          },
          outcome: "violated",
        }
      : { state, outcome: "ignored" };
  }
  if (step !== null && tile !== step.tile) {
    return { state, outcome: "ignored" };
  }

  const board = applySlidePuzzleSlide(state.board, slide);
  const next: SlidePuzzleTutorialBoardState = {
    board,
    moveCount: state.moveCount + 1,
    lastMove: {
      type: "slid",
      slide,
      landedTiles: listLandedTiles(state.board, slide),
    },
  };
  if (isSlidePuzzleSolved(board)) {
    return { state: next, outcome: "solved" };
  }
  return { state: next, outcome: step !== null ? "stepped" : "continued" };
}

/** 空白と同じ行・列にないタイルをタップしたとき。同じ行・列のルールを示した後にだけ起きる。 */
function describeSlidePuzzleTutorialViolation(
  _situation: SlidePuzzleTutorialSituation,
  { lastMove }: SlidePuzzleTutorialBoardState,
): TutorialMessage {
  return {
    headline:
      lastMove?.type === "rejected"
        ? `${lastMove.tile} は空白と同じ行にも列にもありません`
        : "空白と同じ行・列にないタイルはスライドしません",
    detail: null,
  };
}

/** 手順で印を付けるタイル。手を離した後は `null`。 */
export function getSlidePuzzleTutorialStepTile({
  step,
}: SlidePuzzleTutorialSituation): SlidePuzzleTile | null {
  return step?.tile ?? null;
}

/** 手を離した後、手が止まったときに示す、最短で完成させるために次にスライドさせるタイル。完成していれば `null`。 */
export function findSlidePuzzleTutorialHintTile(
  state: SlidePuzzleTutorialBoardState,
): SlidePuzzleTile | null {
  const cellIndex = findNextShortestMoveCellIndex(state.board);
  return cellIndex === null ? null : (state.board[cellIndex] ?? null);
}

/** 導入で、ゴールの盤面から始めの盤面へ崩していく途中の盤面。ゴールから始まり、始めの盤面で終わる。 */
export const slidePuzzleTutorialScrambleBoards: readonly SlidePuzzleBoard[] = [
  ...listBoardsByReading(startBoard),
].reverse();

export const slidePuzzleTutorial: Tutorial<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialStep,
  SlidePuzzleTutorialBoardState,
  SlidePuzzleTutorialAction
> = {
  intro: {
    purpose: "番号が書かれたタイルをスライドさせて、順番に並べるパズルです",
    goalCaption: "この形がゴールです",
    startCaption: "最初はこのように崩れています",
  },
  rules: [
    { id: "slide", label: "空白にスライド" },
    { id: "line", label: "まとめてスライド" },
  ],
  steps,
  freePlay: {
    headline: "残りを収めると完成です",
    detail: null,
  },
  completion: {
    selection: {
      headline: "完成です",
      detail: "レベル1では\nじゃまなタイルをどかしながら並べます",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールです",
    },
  },
  start: startSlidePuzzleTutorial,
  goal: getSlidePuzzleTutorialGoal,
  perform: performSlidePuzzleTutorialAction,
  describeViolation: describeSlidePuzzleTutorialViolation,
};

export const _private = {
  startBoard,
  goalBoard,
  getTileForBlank,
  listBoardsByReading,
  findNextShortestMoveCellIndex,
};
