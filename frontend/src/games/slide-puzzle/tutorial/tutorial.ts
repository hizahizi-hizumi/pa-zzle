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
} from "@/games/slide-puzzle/puzzle/state";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/**
 * - `slide`: 空白の隣のタイルが、空白にスライドする。
 * - `line`: 空白と同じ行・列のタイルは、間のタイルごとまとめてスライドする。
 */
export type SlidePuzzleTutorialRuleId = "slide" | "line";

/** 盤面と同じく、押したタイルのマス。 */
export type SlidePuzzleTutorialAction = { type: "tap"; cellIndex: number };

/**
 * - `cellIndex`: 印を付け、手順の間だけ受け付けるタイルのマス。押して滑らせたら次の手順へ進む。
 *   どの手順の印も、押すとタイルが番号順の場所に収まる。
 * - `cue`: 印を付ける時。
 *   - `immediate`: 手順を始めたらすぐ付ける。ルールを示して、すぐ使わせる手順。
 *   - `whenStuck`: 手が止まったときか、印のタイル以外を押したときだけ付ける。知っていることから、どのタイルかを自分で読ませる手順。
 */
export type SlidePuzzleTutorialStep =
  TutorialStep<SlidePuzzleTutorialRuleId> & {
    cellIndex: number;
    cue: "immediate" | "whenStuck";
  };

/**
 * 直前の手。盤面の上の合図に使う。
 * - `slid`: タイルが滑った。`boardBefore` は滑る前の盤面。
 * - `rejected`: 空白と同じ行・列にないタイルを押して、動かなかった。
 */
export type SlidePuzzleTutorialMove =
  | { type: "slid"; slide: SlidePuzzleSlide; boardBefore: SlidePuzzleBoard }
  | { type: "rejected"; cellIndex: number };

/** `moveCount`: 盤面に応えた手の数。同じタイルへの合図をやり直す目印に使う。 */
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
 * レベル1と同じ 3×3。完成した盤面から空白を1筆書きで動かしただけの配置で、
 * どのタイルも番号順の場所の隣にあり、どの手もタイルを番号順の場所へ収める。最短の解き方はこの1通りに限る。
 *
 * ```text
 * 最初    解
 * 2 3 6   1 2 3
 * 1 4 .   4 5 6
 * 7 5 8   7 8 .
 * ```
 */
const start: SlidePuzzleBoard = [2, 3, 6, 1, 4, SLIDE_PUZZLE_BLANK, 7, 5, 8];
const goal = createSolvedSlidePuzzleBoard(3);

/**
 * 空白の場所に入る番号のタイルを、1手ずつ滑らせていく。
 * 1手目の 6 で空白が右上に移り、上の行の 2 と 3 をまとめて滑らせられるようになる。
 * 3手目は、空白が左上に来たので 1 が入ると、ゴールの形から自分で読ませる。
 * 手順を終えると 4・5・8 が残り、どれも空白の場所の番号を探せば決まる。
 */
const steps: readonly SlidePuzzleTutorialStep[] = [
  {
    message: {
      headline: "空白の隣のタイルは、スライドできます",
      detail: "印のタイルをタップしてください",
    },
    introducedRuleId: "slide",
    cellIndex: 2,
    cue: "immediate",
  },
  {
    message: {
      headline: "空白の行なら、まとめてスライドできます",
      detail: "間のタイルごとスライドします。列でも同じです",
    },
    introducedRuleId: "line",
    cellIndex: 0,
    cue: "immediate",
  },
  {
    message: {
      headline: "空白に入る番号を、ゴールの形で探します",
      detail: "迷ったら、少し待つと印が出ます",
    },
    introducedRuleId: null,
    cellIndex: 3,
    cue: "whenStuck",
  },
];

/** 手順を終えた後、残りを解く押し方。 */
const remainingCellIndices: readonly number[] = [4, 7, 8];

/** 始めの盤面から解き終えるまでの盤面。導入では、これを逆にたどって完成した盤面を崩す。 */
function listSolutionBoards(): SlidePuzzleBoard[] {
  const boards = [start];
  for (const cellIndex of [
    ...steps.map((step) => step.cellIndex),
    ...remainingCellIndices,
  ]) {
    const board = boards[boards.length - 1] ?? start;
    const slide = getSlidePuzzleSlide(board, cellIndex);
    if (slide) {
      boards.push(applySlidePuzzleSlide(board, slide));
    }
  }
  return boards;
}

/** 完成した盤面から、1手ずつ崩して始めの盤面へ戻すまでの盤面。最初が完成した盤面、最後が始めの盤面。 */
export const slidePuzzleTutorialScrambleBoards: readonly SlidePuzzleBoard[] =
  listSolutionBoards().reverse();

function startSlidePuzzleTutorial(): SlidePuzzleTutorialBoardState {
  return { board: start, moveCount: 0, lastMove: null };
}

function getSlidePuzzleTutorialGoal(): SlidePuzzleTutorialBoardState {
  return { board: goal, moveCount: 0, lastMove: null };
}

function performSlidePuzzleTutorialAction(
  { step }: SlidePuzzleTutorialSituation,
  state: SlidePuzzleTutorialBoardState,
  { cellIndex }: SlidePuzzleTutorialAction,
): { state: SlidePuzzleTutorialBoardState; outcome: TutorialMoveOutcome } {
  const tile = state.board[cellIndex];
  if (tile === undefined || tile === SLIDE_PUZZLE_BLANK) {
    return { state, outcome: "ignored" };
  }

  const slide = getSlidePuzzleSlide(state.board, cellIndex);
  // 動かないタイルは、手を引いている間も本番と同じく揺らして、動くタイルの決まりを返す。
  if (!slide) {
    return {
      state: {
        ...state,
        moveCount: state.moveCount + 1,
        lastMove: { type: "rejected", cellIndex },
      },
      outcome: "violated",
    };
  }
  if (step !== null && cellIndex !== step.cellIndex) {
    return { state, outcome: "ignored" };
  }

  const board = applySlidePuzzleSlide(state.board, slide);
  const next: SlidePuzzleTutorialBoardState = {
    board,
    moveCount: state.moveCount + 1,
    lastMove: { type: "slid", slide, boardBefore: state.board },
  };
  if (isSlidePuzzleSolved(board)) {
    return { state: next, outcome: "solved" };
  }
  return { state: next, outcome: step !== null ? "stepped" : "continued" };
}

/** 違反の一言の補足に添える、当たったルールそのもの。 */
const ruleStatements = {
  slide: "空白の隣のタイルが、空白にスライドします",
  line: "空白と同じ行・列のタイルがスライドします",
} as const satisfies Record<SlidePuzzleTutorialRuleId, string>;

/** 動かないタイルを押したときの一言。まとめて滑ることを示す前は、空白の隣かどうかで言う。 */
function describeSlidePuzzleTutorialViolation({
  earnedRuleIds,
}: SlidePuzzleTutorialSituation): TutorialMessage {
  return earnedRuleIds.includes("line")
    ? {
        headline: "空白の行にも列にもないタイルです",
        detail: ruleStatements.line,
      }
    : {
        headline: "このタイルは、空白の隣にありません",
        detail: ruleStatements.slide,
      };
}

/** 手順で印を付けるタイルのマス。手を離した後は `null`。 */
export function getSlidePuzzleTutorialStepCellIndex({
  step,
}: SlidePuzzleTutorialSituation): number | null {
  return step?.cellIndex ?? null;
}

/** 1枚ずつ滑らせる手と、その後の盤面。 */
function listSingleMoves(
  board: SlidePuzzleBoard,
): { cellIndex: number; board: SlidePuzzleBoard }[] {
  return listSlidePuzzleSingleMoves(board).flatMap((cellIndex) => {
    const slide = getSlidePuzzleSlide(board, cellIndex);
    return slide
      ? [{ cellIndex, board: applySlidePuzzleSlide(board, slide) }]
      : [];
  });
}

/** 3×3 の最長の最短手数。これより深くは探さない。 */
const MAXIMUM_OPTIMAL_MOVE_COUNT = 31;

/** `depthLimit` 手以内で解き終えられるか。マンハッタン距離で枝を刈る。 */
function canSolveWithin(
  board: SlidePuzzleBoard,
  depthLimit: number,
  previousBlankIndex: number | null,
): boolean {
  const distance = calculateSlidePuzzleManhattanDistance(board);
  if (distance === 0) {
    return true;
  }
  if (distance > depthLimit) {
    return false;
  }
  const blankIndex = findSlidePuzzleBlankIndex(board);
  return listSingleMoves(board).some(
    (move) =>
      move.cellIndex !== previousBlankIndex &&
      canSolveWithin(move.board, depthLimit - 1, blankIndex),
  );
}

function findOptimalMoveCount(board: SlidePuzzleBoard): number | null {
  for (
    let depthLimit = calculateSlidePuzzleManhattanDistance(board);
    depthLimit <= MAXIMUM_OPTIMAL_MOVE_COUNT;
    depthLimit += 2
  ) {
    if (canSolveWithin(board, depthLimit, null)) {
      return depthLimit;
    }
  }
  return null;
}

/**
 * 手を離した後、手が止まったときに示すタイルのマス。最短で解き終える1枚目を返し、
 * そのうち番号順の場所に収まるタイルがあれば、空白の場所の番号を探す読みに合うそれを選ぶ。解き終えていれば `null`。
 */
export function findSlidePuzzleTutorialHintCellIndex(
  _situation: SlidePuzzleTutorialSituation,
  state: SlidePuzzleTutorialBoardState,
): number | null {
  const optimalMoveCount = findOptimalMoveCount(state.board);
  if (optimalMoveCount === null || optimalMoveCount === 0) {
    return null;
  }
  const blankIndex = findSlidePuzzleBlankIndex(state.board);
  const optimalMoves = listSingleMoves(state.board).filter((move) =>
    canSolveWithin(move.board, optimalMoveCount - 1, blankIndex),
  );
  const settling = optimalMoves.find(
    (move) => state.board[move.cellIndex] === goal[blankIndex],
  );
  return (settling ?? optimalMoves[0])?.cellIndex ?? null;
}

export const slidePuzzleTutorial: Tutorial<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialStep,
  SlidePuzzleTutorialBoardState,
  SlidePuzzleTutorialAction
> = {
  intro: {
    tagline: "番号が書かれたタイルをスライドさせて、順番に並べるパズルです",
    goal: "この形がゴールです",
    start: "最初はこのように崩れています",
  },
  rules: [
    { id: "slide", label: "空白にスライド" },
    { id: "line", label: "まとめてスライド" },
  ],
  steps,
  freePlay: {
    headline: "残りを並べると完成です",
    detail: "迷ったら、少し待つと印が出ます",
  },
  completion: {
    selection: {
      headline: "完成です",
      detail: "レベル1は、少し回り道が要る盤面です",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も、同じ動かし方で並べます",
    },
  },
  start: startSlidePuzzleTutorial,
  goal: getSlidePuzzleTutorialGoal,
  perform: performSlidePuzzleTutorialAction,
  describeViolation: describeSlidePuzzleTutorialViolation,
};

export const _private = { start, goal, remainingCellIndices };
