import {
  type IceFloorMazeBoard,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  applyIceFloorMazeSlide,
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
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

export type IceFloorMazeTutorialRuleId =
  | "slide"
  | "floor"
  | "brittle-rock"
  | "thin-ice"
  | "snow"
  | "sliding-block"
  | "goal";

export type IceFloorMazeTutorialAction = { direction: IceFloorMazeDirection };

/**
 * - `target`: 印を付け、手順の間だけそこで止まる滑りを受け付けるマス。駒をそこで止めると次の手順へ進む。
 */
export type IceFloorMazeTutorialStep =
  TutorialStep<IceFloorMazeTutorialRuleId> & {
    target: number;
  };

type IceFloorMazeSlid = Extract<IceFloorMazeSlide, { status: "slid" }>;

/**
 * 1回の滑りを、どのルールで読めば止まる位置と盤面の変わり方が分かるか。
 * - `ruleIds`: その滑りを読むのに要るルール。
 * - `reasonCellIndices`: 止まる位置と盤面の変わり方を決めるマス（決め手）。止めた岩・入った床・割れる薄い氷・押し出す雪とその先・
 *   押す塊とそれを止める岩・通るゴールなど。外壁で止まる滑りでは、止めたマスを含めない。
 */
export type IceFloorMazeTutorialSlideReading = {
  ruleIds: readonly IceFloorMazeTutorialRuleId[];
  reasonCellIndices: readonly number[];
};

/** 直前の滑り。`reasonCellIndices` は滑る前の盤面で読んだ決め手。 */
export type IceFloorMazeTutorialMove = {
  slide: IceFloorMazeSlid;
  reasonCellIndices: readonly number[];
};

/** `moveCount`: 盤面が変わった手の数。滑りごとの動きと音を見分ける目印に使う。 */
export type IceFloorMazeTutorialBoardState = {
  puzzleState: IceFloorMazeState;
  moveCount: number;
  lastMove: IceFloorMazeTutorialMove | null;
};

export type IceFloorMazeTutorialSituation = TutorialSituation<
  IceFloorMazeTutorialRuleId,
  IceFloorMazeTutorialStep
>;

/**
 * 6×6 の盤面に、床・薄い氷・もろい岩・雪・滑る氷の塊を1つずつ置く。
 * 手順で、止める岩・床・薄い氷・もろい岩・雪・氷の塊・ゴールを1つずつ使いながら盤面を一回りする。
 * 薄い氷が割れてできた水面は、ゴールを通り過ぎる手順の止め役として、押し出した雪山は手を離した後の止め役として使う。
 * 手を離した後は3手でゴールに止まり、どう滑っても詰まない。
 *
 * ```text
 * S . # . # .
 * # o . # . #
 * . c . G m .
 * . . . . . b
 * . # . . s .
 * . . . . . .
 * ```
 */
const board: IceFloorMazeBoard = parseIceFloorMazeBoard([
  "..#.#.",
  "#o.#.#",
  ".c..m.",
  ".....b",
  ".#..s.",
  "......",
]);

function cellAt(x: number, y: number): number {
  return y * board.width + x;
}

const start = cellAt(0, 0);
const goal = cellAt(3, 2);

/** チュートリアルの1枚の盤面。開始位置とゴールは本番と同じく氷のマスに置く。 */
export const iceFloorMazeTutorialPuzzle = { board, start, goal } as const;

/**
 * 岩の手前（右）、床（下）、薄い氷を抜けて岩の手前（下）、もろい岩の手前（右）、雪（下）、塊を押して（上）、
 * ゴールを通り過ぎて水面の手前（左）の順に止める。
 * 1手目は、始めの盤面からゴールに止まる最短の道筋の1手目でもある。
 */
const steps: readonly IceFloorMazeTutorialStep[] = [
  {
    message: {
      headline: "駒は岩か壁にぶつかるまで\n滑ります",
      detail: "右へスワイプしてください",
    },
    introducedRuleId: "slide",
    target: cellAt(1, 0),
  },
  {
    message: {
      headline: "駒は床に入ると止まります",
      detail: null,
    },
    introducedRuleId: "floor",
    target: cellAt(1, 1),
  },
  {
    message: {
      headline: "薄い氷は、駒が通ると割れて\n水面になります",
      detail: "水面は岩と同じく駒を止めます",
    },
    introducedRuleId: "thin-ice",
    target: cellAt(1, 3),
  },
  {
    message: {
      headline: "もろい岩は、一度駒を止めると\n崩れます",
      detail: null,
    },
    introducedRuleId: "brittle-rock",
    target: cellAt(4, 3),
  },
  {
    message: {
      headline: "駒は雪に入ると止まり\n雪を1マス先へ押し出します",
      detail: "押し出した雪は雪山になり、駒を止めます",
    },
    introducedRuleId: "snow",
    target: cellAt(4, 4),
  },
  {
    message: {
      headline: "駒は氷の塊にぶつかると\n塊を押しながら滑ります",
      detail: "塊が止まると、駒もそのすぐ手前で止まります",
    },
    introducedRuleId: "sliding-block",
    target: cellAt(4, 2),
  },
  {
    message: {
      headline: "ゴールを通り過ぎるだけでは\n完成しません",
      detail: null,
    },
    introducedRuleId: "goal",
    target: cellAt(2, 2),
  },
];

function getStopperRuleId(
  state: IceFloorMazeState,
  stopper: number,
): IceFloorMazeTutorialRuleId | null {
  if (state.blocks.includes(stopper)) {
    return "sliding-block";
  }
  switch (state.cells[stopper]) {
    case "brittle-rock":
      return "brittle-rock";
    case "water":
      return "thin-ice";
    case "snow":
    case "snow-mound":
      return "snow";
    // 岩・盤面の外は滑るルールだけで読める。
    default:
      return null;
  }
}

/** `state` は滑る前の状態。 */
export function readIceFloorMazeTutorialSlide(
  state: IceFloorMazeState,
  slide: IceFloorMazeSlid,
): IceFloorMazeTutorialSlideReading {
  const ruleIds = new Set<IceFloorMazeTutorialRuleId>(["slide"]);
  const reasonCellIndices: number[] = [];

  function addStopper(stopper: number | null): void {
    if (stopper === null) {
      return;
    }
    reasonCellIndices.push(stopper);
    const ruleId = getStopperRuleId(state, stopper);
    if (ruleId !== null) {
      ruleIds.add(ruleId);
    }
  }

  const thinIce = [slide.from, ...slide.path].filter(
    (cellIndex) => state.cells[cellIndex] === "thin-ice",
  );
  if (thinIce.length > 0) {
    ruleIds.add("thin-ice");
    reasonCellIndices.push(...thinIce);
  }
  if (slide.path.includes(goal)) {
    ruleIds.add("goal");
    reasonCellIndices.push(goal);
  }
  if (state.cells[slide.to] === "floor") {
    ruleIds.add("floor");
    reasonCellIndices.push(slide.to);
  } else if (slide.pushedSnow) {
    ruleIds.add("snow");
    reasonCellIndices.push(slide.pushedSnow.from, slide.pushedSnow.to);
  } else if (slide.movedBlock) {
    ruleIds.add("sliding-block");
    reasonCellIndices.push(slide.movedBlock.from);
    addStopper(
      getIceFloorMazeNeighbor(board, slide.movedBlock.to, slide.direction),
    );
  } else {
    addStopper(getIceFloorMazeNeighbor(board, slide.to, slide.direction));
  }
  return { ruleIds: [...ruleIds], reasonCellIndices };
}

/** 今の状態から最短でゴールに止まる滑りの向きの並び。ゴールにいれば空、止まれなければ `null`。 */
function findShortestDirections(
  state: IceFloorMazeState,
): IceFloorMazeDirection[] | null {
  const graph = exploreIceFloorMazeStates(board, state, { goal });
  if (!graph) {
    return null;
  }
  const arrival = graph.states.findIndex(({ position }) => position === goal);
  if (arrival < 0) {
    return null;
  }
  // 状態は起点からの最少手数の順に並ぶので、最初に見つかる前の状態が最短の道筋の1つ前になる。
  const previous = new Map<
    number,
    { from: number; direction: IceFloorMazeDirection }
  >();
  graph.moves.forEach((moves, from) => {
    for (const { to, direction } of moves) {
      if (to !== 0 && !previous.has(to)) {
        previous.set(to, { from, direction });
      }
    }
  });
  const directions: IceFloorMazeDirection[] = [];
  for (let current = arrival; current !== 0; ) {
    const step = previous.get(current)!;
    directions.unshift(step.direction);
    current = step.from;
  }
  return directions;
}

function slideTutorialState(
  state: IceFloorMazeState,
  direction: IceFloorMazeDirection,
): IceFloorMazeState {
  const slide = slideIceFloorMazePiece(board, state, direction);
  return slide.status === "slid" ? applyIceFloorMazeSlide(state, slide) : state;
}

function findStepSlide(
  state: IceFloorMazeState,
  target: number,
): IceFloorMazeSlid | null {
  for (const direction of iceFloorMazeDirections) {
    const slide = slideIceFloorMazePiece(board, state, direction);
    if (slide.status === "slid" && slide.to === target) {
      return slide;
    }
  }
  return null;
}

const startState = createIceFloorMazeInitialState(board, start);

/** 手順をすべて終えて手を離すときの状態。 */
const freePlayState = steps.reduce((state, step) => {
  const slide = findStepSlide(state, step.target);
  return slide ? applyIceFloorMazeSlide(state, slide) : state;
}, startState);

/** 手を離した後を最短で進めて、ゴールに止まった状態。導入でゴールとして見せる。 */
const solvedState = (findShortestDirections(freePlayState) ?? []).reduce(
  slideTutorialState,
  freePlayState,
);

function startIceFloorMazeTutorial(): IceFloorMazeTutorialBoardState {
  return { puzzleState: startState, moveCount: 0, lastMove: null };
}

function getIceFloorMazeTutorialGoal(): IceFloorMazeTutorialBoardState {
  return { puzzleState: solvedState, moveCount: 0, lastMove: null };
}

/**
 * 手を引いている間は、印のマスで止まる滑りだけを受け付ける。手を離した後は本番と同じく、成立する滑りはすべて受け付ける。
 * 1マスも動けない向きは、本番と同じく盤面を変えない。
 */
function performIceFloorMazeTutorialAction(
  { step }: IceFloorMazeTutorialSituation,
  state: IceFloorMazeTutorialBoardState,
  { direction }: IceFloorMazeTutorialAction,
): { state: IceFloorMazeTutorialBoardState; outcome: TutorialMoveOutcome } {
  const slide = slideIceFloorMazePiece(board, state.puzzleState, direction);
  if (slide.status !== "slid" || (step !== null && slide.to !== step.target)) {
    return { state, outcome: "ignored" };
  }

  const puzzleState = applyIceFloorMazeSlide(state.puzzleState, slide);
  const next: IceFloorMazeTutorialBoardState = {
    puzzleState,
    moveCount: state.moveCount + 1,
    lastMove: {
      slide,
      reasonCellIndices: readIceFloorMazeTutorialSlide(state.puzzleState, slide)
        .reasonCellIndices,
    },
  };
  if (isIceFloorMazeCleared(puzzleState.position, goal)) {
    return { state: next, outcome: "solved" };
  }
  return { state: next, outcome: step !== null ? "stepped" : "continued" };
}

/** どの滑りもルールに合うので、ルールに合わない手は起きない。契約を満たすため、今の手順か手を離した後の一言を返す。 */
function describeIceFloorMazeTutorialViolation({
  step,
}: IceFloorMazeTutorialSituation): TutorialMessage {
  return step?.message ?? freePlay;
}

/**
 * 手順の印のマスと、そこへ止まる滑りで駒が通るマス（`path`、印のマスを含む）と、その滑りの決め手。
 * 手を離した後と、印のマスへ止まれないときは `null`。
 */
export function getIceFloorMazeTutorialStepFocus(
  { step }: IceFloorMazeTutorialSituation,
  { puzzleState }: IceFloorMazeTutorialBoardState,
): {
  target: number;
  path: readonly number[];
  reasonCellIndices: readonly number[];
} | null {
  if (step === null) {
    return null;
  }
  const slide = findStepSlide(puzzleState, step.target);
  return slide
    ? {
        target: step.target,
        path: slide.path,
        reasonCellIndices: readIceFloorMazeTutorialSlide(puzzleState, slide)
          .reasonCellIndices,
      }
    : null;
}

/**
 * 直前の滑りで駒が通ったマスと、その決め手と、動いた雪・塊の行き先。手順どおりに滑らせてから次の印を出すまで、元の明るさで残す。
 */
export function listIceFloorMazeTutorialMoveCellIndices({
  slide,
  reasonCellIndices,
}: IceFloorMazeTutorialMove): number[] {
  return [
    ...new Set([
      slide.from,
      ...slide.path,
      ...reasonCellIndices,
      ...(slide.pushedSnow ? [slide.pushedSnow.to] : []),
      ...(slide.movedBlock ? [slide.movedBlock.to] : []),
    ]),
  ];
}

/** 手を離した後、手が止まったときに示す、最短でゴールに止まるために次に止まるマス。ゴールにいれば `null`。 */
export function findIceFloorMazeTutorialHintCellIndex({
  puzzleState,
}: IceFloorMazeTutorialBoardState): number | null {
  const [direction] = findShortestDirections(puzzleState) ?? [];
  return direction === undefined
    ? null
    : slideTutorialState(puzzleState, direction).position;
}

const freePlay: TutorialMessage = {
  headline: "ここからは自分で\n駒をゴールで止めてみましょう",
  detail: null,
};

export const iceFloorMazeTutorial: Tutorial<
  IceFloorMazeTutorialRuleId,
  IceFloorMazeTutorialStep,
  IceFloorMazeTutorialBoardState,
  IceFloorMazeTutorialAction
> = {
  intro: {
    purpose: "駒を氷の上で滑らせて、\nゴールでぴたりと止めるパズルです",
    goalCaption: "駒がゴールの印で止まれば完成です",
    startCaption: "この盤面から始めます",
  },
  rules: [
    { id: "slide", label: "滑る" },
    { id: "floor", label: "床" },
    { id: "thin-ice", label: "薄い氷" },
    { id: "brittle-rock", label: "もろい岩" },
    { id: "snow", label: "雪" },
    { id: "sliding-block", label: "氷の塊" },
    { id: "goal", label: "ゴール" },
  ],
  steps,
  freePlay,
  completion: {
    home: {
      headline: "完成です",
      detail: "どのレベルも同じルールです",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールです",
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
  solvedState,
  findShortestDirections,
  findStepSlide,
};
