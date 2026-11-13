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

export type SlidePuzzleTutorialRuleId = "line" | "pair";

export type SlidePuzzleTutorialAction = { cellIndex: number };

/**
 * 手を引く道（`guidedTiles` を1枚ずつスライドさせた盤面の並び）の一区切り。道に沿った手だけを受け付け、`endMoveIndex` まで進むと次の手順へ進む。
 * - `cue`: `marked` は次に押すタイルに印を付けて押させる。`search` は印を付けずに自分で探させ、道に無い手を押したときや手が止まったときにだけ印を付ける。
 * - `lureTile`: 手順の始まりに、次に押すタイルの代わりに印を付けるタイル。押すとルールの違反になり、それから直す手に印を移す。
 * - `focusTiles`: その手を決めるタイル（決め手）。空白と一緒に、盤面の覆いから抜いて見せる。空なら覆わない。
 */
export type SlidePuzzleTutorialStep =
  TutorialStep<SlidePuzzleTutorialRuleId> & {
    cue: "marked" | "search";
    startMoveIndex: number;
    endMoveIndex: number;
    lureTile: SlidePuzzleTile | null;
    focusTiles: readonly SlidePuzzleTile[];
  };

export type SlidePuzzleTutorialMove =
  | {
      type: "slid";
      slide: SlidePuzzleSlide;
      /** この手で自分の場所に収まったタイル。 */
      landedTiles: readonly SlidePuzzleTile[];
    }
  | { type: "rejected"; tile: SlidePuzzleTile; cellIndex: number };

export type SlidePuzzleTutorialBoardState = {
  board: SlidePuzzleBoard;
  /** 手を引く道をどこまで進んだか。スライドしたタイルの枚数で数える。手を離した後は増やさない。 */
  guidedMoveIndex: number;
  /** 盤面に反応した手の数。同じタイルへの合図をやり直す目印に使う。 */
  moveCount: number;
  lastMove: SlidePuzzleTutorialMove | null;
};

export type SlidePuzzleTutorialSituation = TutorialSituation<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialStep
>;

/**
 * ```text
 * 最初    上の行が揃った後   ゴール
 * 1 7 2   1 2 3              1 2 3
 * _ 4 5   4 7 _              4 5 6
 * 8 6 3   8 5 6              7 8 _
 * ```
 */
const startBoard: SlidePuzzleBoard = [1, 7, 2, 0, 4, 5, 8, 6, 3];
const goalBoard = createSolvedSlidePuzzleBoard(3);

const guidedTiles: readonly SlidePuzzleTile[] = [
  4, 7, 2, 2, 7, 5, 3, 6, 5, 7, 2, 3,
];

function slideTile(
  board: SlidePuzzleBoard,
  tile: SlidePuzzleTile,
): SlidePuzzleBoard {
  const slide = getSlidePuzzleSlide(board, board.indexOf(tile));
  if (slide?.movedTileIndices.length !== 1) {
    throw new RangeError(`Slide puzzle tutorial cannot slide ${tile}`);
  }
  return applySlidePuzzleSlide(board, slide);
}

/** 手を引く道の盤面。`guidedBoards[i]` は、i 枚スライドさせた後の盤面。 */
const guidedBoards: readonly SlidePuzzleBoard[] = listGuidedBoards();

function listGuidedBoards(): SlidePuzzleBoard[] {
  const boards = [startBoard];
  for (const tile of guidedTiles) {
    boards.push(slideTile(boards.at(-1) ?? startBoard, tile));
  }
  return boards;
}

const steps: readonly SlidePuzzleTutorialStep[] = [
  {
    message: {
      headline: "空白の隣のタイルをタップしてスライドさせます",
      detail: null,
    },
    introducedRuleId: null,
    cue: "marked",
    startMoveIndex: 0,
    endMoveIndex: 1,
    lureTile: null,
    focusTiles: [],
  },
  {
    message: {
      headline: "空白と同じ行か列のタイルをタップしてスライドさせます",
      detail: "2を1の右へ入れます",
    },
    introducedRuleId: "line",
    cue: "marked",
    startMoveIndex: 1,
    endMoveIndex: 3,
    lureTile: 2,
    focusTiles: [2],
  },
  {
    message: {
      headline: "1と2を並べたままでは3が入りません",
      detail: "2を右上へずらして3を2の下へ運んで組にします",
    },
    introducedRuleId: "pair",
    cue: "search",
    startMoveIndex: 3,
    endMoveIndex: 7,
    lureTile: null,
    focusTiles: [2, 3],
  },
  {
    message: {
      headline: "空白を2の左へ回して\n2と3を続けて入れます",
      detail: "タイルをまとめてスライドさせることもできます",
    },
    introducedRuleId: null,
    cue: "marked",
    startMoveIndex: 7,
    endMoveIndex: 12,
    lureTile: null,
    focusTiles: [2, 3],
  },
];

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

function isSameBoard(
  left: SlidePuzzleBoard,
  right: SlidePuzzleBoard | undefined,
): boolean {
  return (
    right !== undefined &&
    left.length === right.length &&
    left.every((tile, index) => tile === right[index])
  );
}

const topRowTiles: readonly SlidePuzzleTile[] = [1, 2, 3];
const leftColumnTiles: readonly SlidePuzzleTile[] = [4, 7];

function areTilesAtGoal(
  board: SlidePuzzleBoard,
  tiles: readonly SlidePuzzleTile[],
): boolean {
  return tiles.every((tile) => board[tile - 1] === tile);
}

function listSettledTiles(board: SlidePuzzleBoard): SlidePuzzleTile[] {
  if (!areTilesAtGoal(board, topRowTiles)) {
    return [];
  }
  return areTilesAtGoal(board, leftColumnTiles)
    ? [...topRowTiles, ...leftColumnTiles]
    : [...topRowTiles];
}

/**
 * 完成していれば `null`。
 * 3×3 の盤面は、タイルと自分の場所との距離の和を下限にした反復深化で、どこからでもすぐ求まる。
 */
function findNextShortestMoveCellIndex(
  board: SlidePuzzleBoard,
  fixedTiles: readonly SlidePuzzleTile[],
): number | null {
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
      const tile = current[cellIndex];
      if (
        cellIndex === previousBlankIndex ||
        tile === undefined ||
        fixedTiles.includes(tile)
      ) {
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
  while (Number.isFinite(bound)) {
    const result = search(board, 0, bound, -1);
    if (result === "found") {
      return firstMoves[0] ?? null;
    }
    bound = result;
  }
  return null;
}

function startSlidePuzzleTutorial(): SlidePuzzleTutorialBoardState {
  return {
    board: startBoard,
    guidedMoveIndex: 0,
    moveCount: 0,
    lastMove: null,
  };
}

function getSlidePuzzleTutorialGoal(): SlidePuzzleTutorialBoardState {
  return { ...startSlidePuzzleTutorial(), board: goalBoard };
}

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

  const board = applySlidePuzzleSlide(state.board, slide);
  const guidedMoveIndex =
    step === null
      ? state.guidedMoveIndex
      : state.guidedMoveIndex + slide.movedTileIndices.length;
  if (
    step !== null &&
    (guidedMoveIndex > step.endMoveIndex ||
      !isSameBoard(board, guidedBoards[guidedMoveIndex]))
  ) {
    return { state, outcome: "ignored" };
  }

  const next: SlidePuzzleTutorialBoardState = {
    board,
    guidedMoveIndex,
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
  if (step === null) {
    return { state: next, outcome: "continued" };
  }
  return {
    state: next,
    outcome: guidedMoveIndex === step.endMoveIndex ? "stepped" : "continued",
  };
}

function describeSlidePuzzleTutorialViolation(
  _situation: SlidePuzzleTutorialSituation,
  { lastMove }: SlidePuzzleTutorialBoardState,
): TutorialMessage {
  if (lastMove?.type !== "rejected") {
    return {
      headline: "空白と同じ行か列のタイルをタップしてスライドさせます",
      detail: null,
    };
  }
  return {
    headline: `${lastMove.tile}は空白と同じ行にも\n列にもありません`,
    detail: `空白を${lastMove.tile}と同じ行か列へ動かします`,
  };
}

/** 手を離した後は `null`。`lureTile` のある手順では、ルールの違反を見せるまで `lureTile` を返す。 */
export function getSlidePuzzleTutorialStepTile(
  { step }: SlidePuzzleTutorialSituation,
  { board, guidedMoveIndex, lastMove }: SlidePuzzleTutorialBoardState,
): SlidePuzzleTile | null {
  if (step === null) {
    return null;
  }
  if (
    step.lureTile !== null &&
    guidedMoveIndex === step.startMoveIndex &&
    lastMove?.type !== "rejected"
  ) {
    return step.lureTile;
  }
  return findFarthestGuidedTile(step, board, guidedMoveIndex);
}

/** 手を引く道の次の何手かを、空白と同じ行・列の1回のタップでまとめて進められるなら、そのいちばん遠いタイル。 */
function findFarthestGuidedTile(
  step: SlidePuzzleTutorialStep,
  board: SlidePuzzleBoard,
  guidedMoveIndex: number,
): SlidePuzzleTile | null {
  for (
    let moveIndex = step.endMoveIndex;
    moveIndex > guidedMoveIndex;
    moveIndex -= 1
  ) {
    const tile = guidedTiles[moveIndex - 1];
    const slide =
      tile === undefined
        ? null
        : getSlidePuzzleSlide(board, board.indexOf(tile));
    if (
      tile !== undefined &&
      slide?.movedTileIndices.length === moveIndex - guidedMoveIndex &&
      isSameBoard(applySlidePuzzleSlide(board, slide), guidedBoards[moveIndex])
    ) {
      return tile;
    }
  }
  return null;
}

/** 決め手の無い手順と、手を離した後は空。 */
export function getSlidePuzzleTutorialFocusTiles(
  { step }: SlidePuzzleTutorialSituation,
  { board }: SlidePuzzleTutorialBoardState,
): readonly SlidePuzzleTile[] {
  if (step === null || step.focusTiles.length === 0) {
    return [];
  }
  if (step.cue === "marked") {
    return step.focusTiles;
  }
  const movableTiles = board.filter(
    (tile, cellIndex) =>
      tile !== SLIDE_PUZZLE_BLANK &&
      getSlidePuzzleSlide(board, cellIndex) !== null,
  );
  return [...new Set([...step.focusTiles, ...movableTiles])];
}

export function isSlidePuzzleTutorialLureShown(
  situation: SlidePuzzleTutorialSituation,
  state: SlidePuzzleTutorialBoardState,
): boolean {
  const { step } = situation;
  return (
    step !== null &&
    step.lureTile !== null &&
    getSlidePuzzleTutorialStepTile(situation, state) === step.lureTile &&
    state.guidedMoveIndex === step.startMoveIndex
  );
}

export function isSlidePuzzleTutorialStepCueShownUpfront({
  step,
}: SlidePuzzleTutorialSituation): boolean {
  return step?.cue === "marked";
}

/** 完成していれば `null`。 */
export function findSlidePuzzleTutorialHintTile({
  board,
}: SlidePuzzleTutorialBoardState): SlidePuzzleTile | null {
  const cellIndex = findNextShortestMoveCellIndex(
    board,
    listSettledTiles(board),
  );
  return cellIndex === null ? null : (board[cellIndex] ?? null);
}

export const SLIDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT = steps.length + 1;

export function getSlidePuzzleTutorialProgressRatio(
  stepIndex: number,
  { board }: SlidePuzzleTutorialBoardState,
): number {
  return isSlidePuzzleSolved(board)
    ? 1
    : stepIndex / SLIDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT;
}

export const slidePuzzleTutorial: Tutorial<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialStep,
  SlidePuzzleTutorialBoardState,
  SlidePuzzleTutorialAction
> = {
  intro: {
    purpose: "タイルをスライドさせて\n番号順に並べるパズルです",
    goalCaption: "1から8まで並べて右下を空けると完成です",
  },
  rules: [
    { id: "line", label: "空白と同じ行か列のタイルが動かせます" },
    { id: "pair", label: "行や列の最後の2枚は組にして続けて入れます" },
  ],
  steps,
  freePlay: {
    headline: "残りのタイルも並べてみましょう",
    detail: "上の行と同じように\n左の列から並べます",
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "本番も行や列の最後の2枚は組にして入れると進められます",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面と同じルールです",
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
  guidedTiles,
  guidedBoards,
  listSettledTiles,
  findNextShortestMoveCellIndex,
};
