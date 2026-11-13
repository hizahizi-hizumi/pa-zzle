import {
  type IceFloorMazeBoard,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  applyIceFloorMazeSlide,
  doesIceFloorMazeSlidePassGoal,
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
  type IceFloorMazeSlide,
  iceFloorMazeDirections,
  isIceFloorMazeCleared,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeState,
} from "@/games/ice-floor-maze/puzzle/state";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

export type IceFloorMazeTutorialRuleId = "slide" | "floor" | "goal" | "stopper";

export type IceFloorMazeTutorialAction = { direction: IceFloorMazeDirection };

export type IceFloorMazeTutorialStep =
  TutorialStep<IceFloorMazeTutorialRuleId> & {
    target: number;
  };

export type IceFloorMazeTutorialSlide = Extract<
  IceFloorMazeSlide,
  { status: "slid" }
>;

export type IceFloorMazeTutorialMove = {
  slide: IceFloorMazeTutorialSlide;
  // 手を引いている間の滑り。滑りを見届けてから次の印を出す。
  guided: boolean;
};

export type IceFloorMazeTutorialBoardState = {
  puzzleState: IceFloorMazeState;
  // 盤面が変わった手の数。滑りごとの動きと音を見分ける目印に使う。
  moveCount: number;
  lastMove: IceFloorMazeTutorialMove | null;
};

export type IceFloorMazeTutorialSituation = TutorialSituation<
  IceFloorMazeTutorialRuleId,
  IceFloorMazeTutorialStep
>;

export type IceFloorMazeTutorialFocus = {
  target: number;
  // 覆いから抜くマス。駒のいるマスと印のマスと、印のマスへ最後に滑り込む滑りを決める物（岩・床・通り過ぎるゴール）。
  cellIndices: readonly number[];
  // 印のマスへ最も少ない手数で近づく、次の滑り。
  nextSlide: IceFloorMazeTutorialSlide;
};

/**
 * 6×6 の氷の盤面に、岩4つと床1つを置く。
 *
 * ```text
 * 始まり        ゴール
 * . # . . . .   . # . . . .
 * . . # . . .   . . # . . .
 * . . . . o .   . . . . o .
 * . . . . . .   . . . . . .
 * . . . . G #   . . . . P #
 * # . S . . .   # . . . . .
 * ```
 */
const board: IceFloorMazeBoard = parseIceFloorMazeBoard([
  ".#....",
  "..#...",
  "....o.",
  "......",
  ".....#",
  "#.....",
]);

function cellAt(x: number, y: number): number {
  return y * board.width + x;
}

const start = cellAt(2, 5);
const goal = cellAt(4, 4);

export const iceFloorMazeTutorialPuzzle = { board, start, goal } as const;

/**
 * 上へ滑らせて岩の手前、右へ滑らせて床、下へ滑らせてゴールを通り過ぎた先の壁の手前、の順に1回ずつ止めさせ、
 * 最後に、すぐ上に岩のある左から2列目・上から2行目のマスへ、左・上の2回で止めさせる。
 */
const steps: readonly IceFloorMazeTutorialStep[] = [
  {
    message: {
      headline: "駒は岩か壁にぶつかるまで\n滑ります",
      detail: "上へスワイプして駒を滑らせてみましょう",
    },
    introducedRuleId: null,
    target: cellAt(2, 2),
  },
  {
    message: {
      headline: "駒は緑の床に乗ると止まります",
      detail: "印の緑の床で止めてみましょう",
    },
    introducedRuleId: "floor",
    target: cellAt(4, 2),
  },
  {
    message: {
      headline: "駒はゴールを\n通り過ぎます",
      detail: "ゴールで止めると完成です",
    },
    introducedRuleId: "goal",
    target: cellAt(4, 5),
  },
  {
    message: {
      headline: "止めたいマスの先の岩に\n向けて滑らせます",
      detail: "2回滑らせて\n印のマスで止めましょう",
    },
    introducedRuleId: "stopper",
    target: cellAt(1, 1),
  },
];

function stateAt(position: number): IceFloorMazeState {
  return createIceFloorMazeInitialState(board, position);
}

function listSlides(state: IceFloorMazeState): IceFloorMazeTutorialSlide[] {
  return iceFloorMazeDirections.flatMap((direction) => {
    const slide = slideIceFloorMazePiece(board, state, direction);
    return slide.status === "slid" ? [slide] : [];
  });
}

/**
 * `from` から `target` で止まるまでの最も少ない手数。止まれなければ `null`。
 * ゴールで止まると完成して先へ進めないので、`target` でないゴールからは先をたどらない。
 * 盤面に要素が無く、滑っても盤面は変わらないので、駒の位置だけでたどる。
 */
function measureMovesTo(from: number, target: number): number | null {
  const moveCounts = new Map([[from, 0]]);
  const queue = [from];
  for (let order = 0; order < queue.length; order += 1) {
    const position = queue[order]!;
    if (position === target) {
      return moveCounts.get(position)!;
    }
    if (position === goal) {
      continue;
    }
    for (const slide of listSlides(stateAt(position))) {
      if (!moveCounts.has(slide.to)) {
        moveCounts.set(slide.to, moveCounts.get(position)! + 1);
        queue.push(slide.to);
      }
    }
  }
  return null;
}

/** `target` へ最も少ない手数で近づく滑り。`target` で止まる滑りと、`target` 以外のゴールで止まらずに近づく滑り。 */
function listSlidesToward(
  state: IceFloorMazeState,
  target: number,
): IceFloorMazeTutorialSlide[] {
  const remaining = measureMovesTo(state.position, target);
  if (remaining === null || remaining === 0) {
    return [];
  }
  return listSlides(state).filter(
    (slide) =>
      slide.to === target ||
      (slide.to !== goal && measureMovesTo(slide.to, target) === remaining - 1),
  );
}

/** 滑りの止まる位置を決める物。床で止まれば床、岩で止まればその岩、通り過ぎたゴール。壁で止まれば壁はマスではないので含めない。 */
function listSlideReasonCellIndices(
  slide: IceFloorMazeTutorialSlide,
): number[] {
  const passedGoal = doesIceFloorMazeSlidePassGoal(slide, goal);
  const stopper =
    board.cells[slide.to] === "floor"
      ? slide.to
      : getIceFloorMazeNeighbor(board, slide.to, slide.direction);
  return [
    ...(passedGoal ? [goal] : []),
    ...(stopper === null ? [] : [stopper]),
  ];
}

function getFocus(
  state: IceFloorMazeState,
  target: number,
): IceFloorMazeTutorialFocus | null {
  const [slide] = listSlidesToward(state, target);
  if (!slide) {
    return null;
  }
  // 通り道や道筋を見せると、向きを自分で選ぶ読みが要らなくなるので、印のマスへ最後に滑り込む向きで駒を止める物だけを見せる。
  const lastSlide =
    slide.to === target ? slide : findLastSlideInto(state.position, target);
  return {
    target,
    nextSlide: slide,
    cellIndices: [
      state.position,
      target,
      ...(lastSlide ? listSlideReasonCellIndices(lastSlide) : []),
    ],
  };
}

function findLastSlideInto(
  from: number,
  target: number,
): IceFloorMazeTutorialSlide | null {
  let state = stateAt(from);
  for (;;) {
    const [slide] = listSlidesToward(state, target);
    if (!slide) {
      return null;
    }
    if (slide.to === target) {
      return slide;
    }
    state = stateAt(slide.to);
  }
}

const startState = stateAt(start);

function listStepSlides(
  state: IceFloorMazeState,
  target: number,
): IceFloorMazeTutorialSlide[] {
  const slides: IceFloorMazeTutorialSlide[] = [];
  for (let current = state; current.position !== target; ) {
    const [slide] = listSlidesToward(current, target);
    if (!slide) {
      return slides;
    }
    slides.push(slide);
    current = applyIceFloorMazeSlide(current, slide);
  }
  return slides;
}

/** 手順をすべて終えて手を離すときの状態。盤面は変わらないので、最後の手順の印のマスに駒がいる。 */
const freePlayState = stateAt(steps.at(-1)!.target);

const solvedState = stateAt(goal);

function startIceFloorMazeTutorial(): IceFloorMazeTutorialBoardState {
  return { puzzleState: startState, moveCount: 0, lastMove: null };
}

function getIceFloorMazeTutorialGoal(): IceFloorMazeTutorialBoardState {
  return { puzzleState: solvedState, moveCount: 0, lastMove: null };
}

function performIceFloorMazeTutorialAction(
  { step }: IceFloorMazeTutorialSituation,
  state: IceFloorMazeTutorialBoardState,
  { direction }: IceFloorMazeTutorialAction,
): { state: IceFloorMazeTutorialBoardState; outcome: TutorialMoveOutcome } {
  const slide = slideIceFloorMazePiece(board, state.puzzleState, direction);
  if (
    slide.status !== "slid" ||
    (step !== null &&
      !listSlidesToward(state.puzzleState, step.target).some(
        (accepted) => accepted.direction === direction,
      ))
  ) {
    return { state, outcome: "ignored" };
  }

  const puzzleState = applyIceFloorMazeSlide(state.puzzleState, slide);
  const next: IceFloorMazeTutorialBoardState = {
    puzzleState,
    moveCount: state.moveCount + 1,
    lastMove: { slide, guided: step !== null },
  };
  if (isIceFloorMazeCleared(puzzleState.position, goal)) {
    return { state: next, outcome: "solved" };
  }
  if (step === null) {
    return { state: next, outcome: "continued" };
  }
  return {
    state: next,
    outcome: puzzleState.position === step.target ? "stepped" : "continued",
  };
}

/** どの滑りもルールに合うので、ルールに合わない手は起きない。契約を満たすため、今の手順か手を離した後の一言を返す。 */
function describeIceFloorMazeTutorialViolation({
  step,
}: IceFloorMazeTutorialSituation): TutorialMessage {
  return step?.message ?? freePlay;
}

export function getIceFloorMazeTutorialStepFocus(
  { step }: IceFloorMazeTutorialSituation,
  { puzzleState }: IceFloorMazeTutorialBoardState,
): IceFloorMazeTutorialFocus | null {
  return step === null ? null : getFocus(puzzleState, step.target);
}

export function listIceFloorMazeTutorialMoveCellIndices({
  slide,
}: IceFloorMazeTutorialMove): number[] {
  return [
    ...new Set([
      slide.from,
      ...slide.path,
      ...listSlideReasonCellIndices(slide),
    ]),
  ];
}

export function findIceFloorMazeTutorialHint({
  puzzleState,
}: IceFloorMazeTutorialBoardState):
  | (IceFloorMazeTutorialFocus & { message: TutorialMessage })
  | null {
  const [slide] = listSlidesToward(puzzleState, goal);
  const focus = slide ? getFocus(puzzleState, slide.to) : null;
  if (!slide || !focus) {
    return null;
  }
  const stopper = getIceFloorMazeNeighbor(board, slide.to, slide.direction);
  const ruleId: IceFloorMazeTutorialRuleId =
    board.cells[slide.to] === "floor"
      ? "floor"
      : stopper !== null && board.cells[stopper] === "rock"
        ? "stopper"
        : "slide";
  // 滑るルールは、操作を教える最初の手順の一言で伝えている。
  const { message } =
    ruleId === "slide"
      ? steps[0]!
      : steps.find(({ introducedRuleId }) => introducedRuleId === ruleId)!;
  return { ...focus, message: { headline: message.headline, detail: null } };
}

export const ICE_FLOOR_MAZE_TUTORIAL_PROGRESS_STEP_COUNT = steps.length + 1;

const freePlay: TutorialMessage = {
  headline: "ゴールで止めるにはどこから滑らせるかを逆にたどりましょう",
  detail: null,
};

export const iceFloorMazeTutorial: Tutorial<
  IceFloorMazeTutorialRuleId,
  IceFloorMazeTutorialStep,
  IceFloorMazeTutorialBoardState,
  IceFloorMazeTutorialAction
> = {
  intro: {
    purpose: "駒を氷の上で滑らせて\nゴールで止めるパズルです",
    goalCaption: "ゴールで止めると完成です",
  },
  rules: [
    { id: "slide", label: "駒は岩か壁にぶつかるまで滑ります" },
    { id: "floor", label: "駒は緑の床に乗ると止まります" },
    { id: "goal", label: "ゴールで止めると完成です" },
    { id: "stopper", label: "止めたいマスの先の岩に向けて滑らせます" },
  ],
  steps,
  freePlay,
  completion: {
    home: {
      headline: "完成です",
      detail: "ほかの仕掛けは\n「遊び方」で見られます",
    },
    play: {
      headline: "完成です",
      detail: "ほかの仕掛けは\n「遊び方」で見られます",
    },
  },
  start: startIceFloorMazeTutorial,
  goal: getIceFloorMazeTutorialGoal,
  perform: performIceFloorMazeTutorialAction,
  describeViolation: describeIceFloorMazeTutorialViolation,
};

export const _private = {
  startState,
  freePlayState,
  listSlides,
  listSlidesToward,
  listStepSlides,
  measureMovesTo,
  stateAt,
};

export const iceFloorMazeTutorialRecap: readonly string[] = [
  ...iceFloorMazeTutorial.rules.map(({ label }) => label),
  "ゴールで止めるにはどこから滑らせるかを逆にたどります",
];
