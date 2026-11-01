import {
  createParkingJamInitialState,
  isParkingJamCleared,
  type ParkingJamBoard,
  type ParkingJamMove,
  type ParkingJamState,
  type ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  applyParkingJamMove,
  findParkingJamExitContact,
  listParkingJamLegalMoves,
  type ParkingJamExitContact,
} from "@/games/parking-jam/puzzle/rules";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/**
 * - `straight`: 車は向きに沿って前か後ろへまっすぐ進み、道路まで一度で出る。
 * - `road`: まっすぐ先の外周が、その車線で道路につながっていないと出られない。
 * - `planter`: 途中に植え込みがあると出られない。
 * - `car`: 途中にほかの車があると出られない。先にその車を出すと通れる。
 */
export type ParkingJamTutorialRuleId = "straight" | "road" | "planter" | "car";

/** 盤面と同じく、車をどちらへ出そうとしたか。 */
export type ParkingJamTutorialAction = ParkingJamMove;

/**
 * 出られなかったわけ。車がまっすぐ進んで最初に当たるもの。
 * - `road`: 途中に何もなく、まっすぐ先が道路につながっていない。
 * - `planter`: 植え込みに当たる。
 * - `car`: ほかの車に当たる。
 */
export type ParkingJamTutorialBlocker = "road" | "planter" | "car";

/**
 * 手順で印を付けて出させる車。印の車を出したところで次の手順へ進む。
 * - `waitingMove`: 印の車に塞がれて出られない手。手順の間、盤面でその車の進む先と当たる所を示す。
 */
export type ParkingJamTutorialStep = TutorialStep<ParkingJamTutorialRuleId> & {
  vehicleId: ParkingJamVehicleId;
  waitingMove: ParkingJamMove | null;
};

/**
 * 直前の手。盤面の動きに使う。
 * - `exited`: 車を出した。
 * - `blocked`: 車が `contact` に当たって出られなかった。
 */
export type ParkingJamTutorialMove = ParkingJamMove &
  (
    | { type: "exited" }
    | {
        type: "blocked";
        blocker: ParkingJamTutorialBlocker;
        contact: ParkingJamExitContact;
      }
  );

/** `moveCount` は盤面に反応した手の数。同じ車への動きをやり直す目印に使う。 */
export type ParkingJamTutorialBoardState = {
  puzzle: ParkingJamState;
  moveCount: number;
  lastMove: ParkingJamTutorialMove | null;
};

type ParkingJamTutorialSituation = TutorialSituation<
  ParkingJamTutorialRuleId,
  ParkingJamTutorialStep
>;

/**
 * 5×5の駐車場に7台。手順の車を順に出しながら、出られない向きのわけを1つずつ示し、最後にほかの車を塞いでいる車を先に出す。
 * 手順を終えると、道が空いた右上の車・中段右の車と、その車に塞がれた中段左の車が残る。
 *
 * ```text
 *        上の道路: 2〜4列
 *        1 2 3 4 5
 *   1    . c . . .
 *   2    . c . a a     左の道路: 2〜3行
 *   3    b b . . #     右の道路: 3〜5行
 *   4    d d e f f
 *   5    . . e g g
 *        下の道路: 1〜3列
 * ```
 *
 * - `e`: どちらへも出られる。最初に出させる。
 * - `g`: 左は道路がなく、右へ出る。
 * - `b`: 右は植え込みに当たり、左へ出る。
 * - `c`: 上へ出られる。`a` の左を塞いでいるので、先に出させる。
 * - `a`: 右は道路がなく、左は `c` に当たる。`c` が出た後、手を離してから自分で出させる。
 * - `d`: 左は道路がなく、右は `f` に当たる。手を離した後に、`f` を先に出して読ませる。
 */
const board: ParkingJamBoard = {
  width: 5,
  height: 5,
  vehicles: [
    { id: "c", row: 0, column: 1, orientation: "vertical", length: 2 },
    { id: "a", row: 1, column: 3, orientation: "horizontal", length: 2 },
    { id: "b", row: 2, column: 0, orientation: "horizontal", length: 2 },
    { id: "d", row: 3, column: 0, orientation: "horizontal", length: 2 },
    { id: "e", row: 3, column: 2, orientation: "vertical", length: 2 },
    { id: "f", row: 3, column: 3, orientation: "horizontal", length: 2 },
    { id: "g", row: 4, column: 3, orientation: "horizontal", length: 2 },
  ],
  fixedAreas: [{ row: 2, column: 4, width: 1, height: 1 }],
  roadOpenings: [
    { side: "up", startOffset: 1, length: 3 },
    { side: "left", startOffset: 1, length: 2 },
    { side: "right", startOffset: 2, length: 3 },
    { side: "down", startOffset: 0, length: 3 },
  ],
};

const blockerMessages = {
  road: "まっすぐ先に道路がないと\n出られません",
  planter: "植え込みがあると\n通れません",
  car: "ほかの車があると\n通れません",
} as const satisfies Record<ParkingJamTutorialBlocker, string>;

/**
 * どちらへも出られる車を出させて、操作と、前か後ろへまっすぐ出ていくことを見せる。
 * 次に、まっすぐ先に道路がない向き・植え込みのある向きを避けて出させる。
 * 最後に、ほかの車を塞いでいる車を先に出させる。塞がれた車は、手を離してから自分で出させる。
 */
const steps: readonly ParkingJamTutorialStep[] = [
  {
    message: {
      headline: "車を出したい向きへ\nスワイプします",
      detail: "前にも後ろにも出られます",
    },
    introducedRuleId: "straight",
    vehicleId: "e",
    waitingMove: null,
  },
  {
    message: { headline: blockerMessages.road, detail: null },
    introducedRuleId: "road",
    vehicleId: "g",
    waitingMove: null,
  },
  {
    message: { headline: blockerMessages.planter, detail: null },
    introducedRuleId: "planter",
    vehicleId: "b",
    waitingMove: null,
  },
  {
    message: {
      headline: blockerMessages.car,
      detail: "じゃまな車を先に出します",
    },
    introducedRuleId: "car",
    vehicleId: "c",
    waitingMove: { vehicleId: "a", direction: "left" },
  },
];

function startParkingJamTutorial(): ParkingJamTutorialBoardState {
  return {
    puzzle: createParkingJamInitialState(board),
    moveCount: 0,
    lastMove: null,
  };
}

/** すべての車を出し終えた、空の駐車場。 */
function getParkingJamTutorialGoal(): ParkingJamTutorialBoardState {
  return {
    puzzle: { remainingVehicleIds: [] },
    moveCount: 0,
    lastMove: null,
  };
}

const contactBlockers = {
  wall: "road",
  "fixed-area": "planter",
  vehicle: "car",
} as const satisfies Record<
  ParkingJamExitContact["blocker"]["kind"],
  ParkingJamTutorialBlocker
>;

/** 出られない手で、車がまっすぐ進んで最初に当たるもの。出られる手と、車の向きに沿わない手は `null`。 */
export function findParkingJamTutorialContact(
  puzzle: ParkingJamState,
  move: ParkingJamMove,
): ParkingJamExitContact | null {
  return findParkingJamExitContact(board, puzzle, move);
}

/** 出られなかったわけ。出られる手と、車の向きに沿わない手は `null`。 */
export function findParkingJamTutorialBlocker(
  puzzle: ParkingJamState,
  move: ParkingJamMove,
): ParkingJamTutorialBlocker | null {
  const contact = findParkingJamTutorialContact(puzzle, move);
  return contact && contactBlockers[contact.blocker.kind];
}

function withMove(
  state: ParkingJamTutorialBoardState,
  lastMove: ParkingJamTutorialMove,
  puzzle: ParkingJamState,
): ParkingJamTutorialBoardState {
  return { puzzle, moveCount: state.moveCount + 1, lastMove };
}

/**
 * 手を引いている間は、印の車だけを受け付ける。印の車が出られない向きへ進もうとしたら、本番と同じく当たって止まる。
 * 手を離した後は本番と同じく、どの車も受け付ける。出られない手は、手に入れたルールに合わない手として返す。
 */
function performParkingJamTutorialAction(
  { step }: ParkingJamTutorialSituation,
  state: ParkingJamTutorialBoardState,
  move: ParkingJamTutorialAction,
): { state: ParkingJamTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { puzzle } = state;
  if (
    !puzzle.remainingVehicleIds.includes(move.vehicleId) ||
    (step !== null && move.vehicleId !== step.vehicleId)
  ) {
    return { state, outcome: "ignored" };
  }

  const next = applyParkingJamMove(board, puzzle, move);
  if (next) {
    const exited = withMove(state, { ...move, type: "exited" }, next);
    if (isParkingJamCleared(next)) {
      return { state: exited, outcome: "solved" };
    }
    return { state: exited, outcome: step ? "stepped" : "continued" };
  }

  const contact = findParkingJamTutorialContact(puzzle, move);
  if (contact === null) {
    return { state, outcome: "ignored" };
  }
  return {
    state: withMove(
      state,
      {
        ...move,
        type: "blocked",
        blocker: contactBlockers[contact.blocker.kind],
        contact,
      },
      puzzle,
    ),
    outcome: "violated",
  };
}

/** 出られない手をしたとき。当たったものを、手順でそのルールを示した見出しと同じ文で言う。 */
function describeParkingJamTutorialViolation(
  _situation: ParkingJamTutorialSituation,
  { lastMove }: ParkingJamTutorialBoardState,
): TutorialMessage {
  return {
    headline:
      lastMove?.type === "blocked"
        ? blockerMessages[lastMove.blocker]
        : blockerMessages.car,
    detail: null,
  };
}

/** 手順で印を付ける車。手を離した後は `null`。 */
export function getParkingJamTutorialStepVehicle({
  step,
}: ParkingJamTutorialSituation): ParkingJamVehicleId | null {
  return step?.vehicleId ?? null;
}

/** 手を離した後、手が止まったときに示す、今出せる車。出し終えていれば `null`。 */
export function findParkingJamTutorialHintVehicle({
  puzzle,
}: ParkingJamTutorialBoardState): ParkingJamVehicleId | null {
  return listParkingJamLegalMoves(board, puzzle)[0]?.vehicleId ?? null;
}

/**
 * 始めの盤面から、すべての車を出し終えるまでの1通りの出し方。導入で、車が出ていって空になる駐車場をゴールとして見せるのに使う。
 */
export function listParkingJamTutorialSolution(): ParkingJamMove[] {
  const moves: ParkingJamMove[] = [];
  let puzzle = createParkingJamInitialState(board);
  for (let move = listParkingJamLegalMoves(board, puzzle)[0]; move; ) {
    moves.push(move);
    puzzle = applyParkingJamMove(board, puzzle, move) ?? puzzle;
    move = listParkingJamLegalMoves(board, puzzle)[0];
  }
  return moves;
}

export const PARKING_JAM_TUTORIAL_BOARD = board;

export const parkingJamTutorial: Tutorial<
  ParkingJamTutorialRuleId,
  ParkingJamTutorialStep,
  ParkingJamTutorialBoardState,
  ParkingJamTutorialAction
> = {
  intro: {
    purpose: "駐車場の車を\nすべて道路へ出すパズルです",
    goalCaption: "駐車場が空になったらゴールです",
    startCaption: "最初は車が詰まっています",
  },
  rules: [
    { id: "straight", label: "前か後ろへ" },
    { id: "road", label: "道路へ出る" },
    { id: "planter", label: "植え込み" },
    { id: "car", label: "ほかの車" },
  ],
  steps,
  freePlay: {
    headline: "残りの車も出すと完成です",
    detail: null,
  },
  completion: {
    selection: {
      headline: "完成です",
      detail:
        "レベル1には長い車も停まっています\n出られない向きへ動かすと、ミスに数えます",
    },
    play: {
      headline: "完成です",
      detail: "出られない向きへ動かすと、ミスに数えます",
    },
  },
  start: startParkingJamTutorial,
  goal: getParkingJamTutorialGoal,
  perform: performParkingJamTutorialAction,
  describeViolation: describeParkingJamTutorialViolation,
};
