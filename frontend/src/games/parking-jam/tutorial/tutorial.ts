import {
  createParkingJamInitialState,
  isParkingJamCleared,
  type ParkingJamBoard,
  type ParkingJamDirection,
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

export type ParkingJamTutorialRuleId = "straight" | "road" | "planter" | "car";

export type ParkingJamTutorialAction = ParkingJamMove;

export type ParkingJamTutorialBlocker = "road" | "planter" | "car";

export type ParkingJamTutorialStep = TutorialStep<ParkingJamTutorialRuleId> & {
  vehicleId: ParkingJamVehicleId;
  // 手順で示すルールで出られない手。その手の車と当たるものが、印の車をどう出すかを決める（決め手）。操作を見せる手順では `null`。
  ruledOutMove: ParkingJamMove | null;
};

export type ParkingJamTutorialContactedMove = {
  move: ParkingJamMove;
  contact: ParkingJamExitContact;
};

export type ParkingJamTutorialMove = ParkingJamMove &
  (
    | { type: "exited" }
    | {
        type: "blocked";
        blocker: ParkingJamTutorialBlocker;
        contact: ParkingJamExitContact;
      }
  );

export type ParkingJamTutorialBoardState = {
  puzzle: ParkingJamState;
  // 盤面に反応した手の数。同じ車への動きをやり直す目印に使う。
  moveCount: number;
  lastMove: ParkingJamTutorialMove | null;
};

type ParkingJamTutorialSituation = TutorialSituation<
  ParkingJamTutorialRuleId,
  ParkingJamTutorialStep
>;

/**
 * 5×5の駐車場に7台。
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
  road: "進む先に道路がないと\n出られません",
  planter: "植え込みがあると\n通れません",
  car: "ほかの車があると\n通れません",
} as const satisfies Record<ParkingJamTutorialBlocker, string>;

const steps: readonly ParkingJamTutorialStep[] = [
  {
    message: {
      headline: "車を出したい向きへ\nスワイプします",
      detail: "上にも下にも出られます",
    },
    introducedRuleId: "straight",
    vehicleId: "e",
    ruledOutMove: null,
  },
  {
    message: { headline: blockerMessages.road, detail: null },
    introducedRuleId: "road",
    vehicleId: "g",
    ruledOutMove: { vehicleId: "g", direction: "left" },
  },
  {
    message: { headline: blockerMessages.planter, detail: null },
    introducedRuleId: "planter",
    vehicleId: "b",
    ruledOutMove: { vehicleId: "b", direction: "right" },
  },
  {
    message: {
      headline: blockerMessages.car,
      detail: "じゃまな車から出します",
    },
    introducedRuleId: "car",
    vehicleId: "c",
    ruledOutMove: { vehicleId: "a", direction: "left" },
  },
];

function startParkingJamTutorial(): ParkingJamTutorialBoardState {
  return {
    puzzle: createParkingJamInitialState(board),
    moveCount: 0,
    lastMove: null,
  };
}

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

export function findParkingJamTutorialContact(
  puzzle: ParkingJamState,
  move: ParkingJamMove,
): ParkingJamExitContact | null {
  return findParkingJamExitContact(board, puzzle, move);
}

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

const directionNames = {
  up: "上",
  right: "右",
  down: "下",
  left: "左",
} as const satisfies Record<ParkingJamDirection, string>;

const violationMessages = {
  road: (direction) => `${direction}へ進む先に道路がないので\n出られません`,
  planter: (direction) => `${direction}に植え込みがあるので\n通れません`,
  car: (direction) => `${direction}にほかの車があるので\n通れません`,
} as const satisfies Record<
  ParkingJamTutorialBlocker,
  (direction: string) => string
>;

function describeParkingJamTutorialViolation(
  situation: ParkingJamTutorialSituation,
  { lastMove }: ParkingJamTutorialBoardState,
): TutorialMessage {
  if (lastMove?.type !== "blocked") {
    return situation.step?.message ?? parkingJamTutorial.freePlay;
  }
  return {
    headline: violationMessages[lastMove.blocker](
      directionNames[lastMove.direction],
    ),
    detail: null,
  };
}

export function findParkingJamTutorialDecider(
  { step }: ParkingJamTutorialSituation,
  { puzzle }: ParkingJamTutorialBoardState,
): ParkingJamTutorialContactedMove | null {
  const move = step?.ruledOutMove ?? null;
  const contact = move && findParkingJamTutorialContact(puzzle, move);
  return move && contact ? { move, contact } : null;
}

export function getParkingJamTutorialStepVehicle({
  step,
}: ParkingJamTutorialSituation): ParkingJamVehicleId | null {
  return step?.vehicleId ?? null;
}

export function findParkingJamTutorialHintVehicle({
  puzzle,
}: ParkingJamTutorialBoardState): ParkingJamVehicleId | null {
  return listParkingJamLegalMoves(board, puzzle)[0]?.vehicleId ?? null;
}

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
    startCaption: "最初は車でいっぱいです",
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
    home: {
      headline: "完成です",
      detail:
        "長い車も同じルールで出せます\n出られない向きへ動かすとミスに数えます",
    },
    play: {
      headline: "完成です",
      detail: "出られない向きへ動かすとミスに数えます",
    },
  },
  start: startParkingJamTutorial,
  goal: getParkingJamTutorialGoal,
  perform: performParkingJamTutorialAction,
  describeViolation: describeParkingJamTutorialViolation,
};
