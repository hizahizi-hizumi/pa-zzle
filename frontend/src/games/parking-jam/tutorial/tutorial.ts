import {
  createParkingJamInitialState,
  isParkingJamCleared,
  type ParkingJamBoard,
  type ParkingJamDirection,
  type ParkingJamMove,
  type ParkingJamState,
  type ParkingJamVehicle,
  type ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  applyParkingJamMove,
  findParkingJamExitContact,
  listParkingJamLegalMoves,
  listParkingJamMoveBlockers,
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
  // どちらへも出られる手順では、手前の道路へ出る向きにする。
  exitDirection: ParkingJamDirection;
  // 手順で示すルールで出られない手。その手の車と、その手でぶつかるものが、印の車をどう出すかを決める（決め手）。操作を教える手順では `null`。
  ruledOutMove: ParkingJamMove | null;
};

export type ParkingJamTutorialContactedMove = {
  move: ParkingJamMove;
  contact: ParkingJamExitContact;
};

export type ParkingJamTutorialFix =
  | { kind: "opposite" }
  | {
      kind: "clear";
      direction: ParkingJamDirection;
      vehicleIds: readonly ParkingJamVehicleId[];
    };

export type ParkingJamTutorialMove = ParkingJamMove &
  (
    | { type: "exited" }
    | {
        type: "blocked";
        blocker: ParkingJamTutorialBlocker;
        contact: ParkingJamExitContact;
        fix: ParkingJamTutorialFix | null;
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
 * 6×6の駐車場に8台（うち3台は3マスの長い車）と植え込み1つ。
 *
 * ```text
 *          上の道路: 2〜3列
 *        1 2 3 4 5 6
 *   1    . d . . f f
 *   2    . d . . e e     左の道路: 1〜5行
 *   3    g g g h h h
 *   4    . . . a a .     右の道路: 4〜6行
 *   5    c c c . # .
 *   6    . b b . . .
 *          下の道路: 2〜4列
 * ```
 *
 * - `a`: どちらへも出られる。最初に出させて、操作を教える。
 * - `b`: 左は道路がなく、右へ出る。
 * - `c`: 右は植え込みにぶつかり、左へ出る。
 * - `d`: 下は `g` にぶつかり、上へ出る。`e` の左を塞いでいるので、先に出させる。
 * - 手を離した後: `e`・`f`・`g` は左へ出られる。`h` は右に道路がなく、左は `g` に塞がれているので、`g` を先に出すと読ませる。
 */
const board: ParkingJamBoard = {
  width: 6,
  height: 6,
  vehicles: [
    { id: "d", row: 0, column: 1, orientation: "vertical", length: 2 },
    { id: "f", row: 0, column: 4, orientation: "horizontal", length: 2 },
    { id: "e", row: 1, column: 4, orientation: "horizontal", length: 2 },
    { id: "g", row: 2, column: 0, orientation: "horizontal", length: 3 },
    { id: "h", row: 2, column: 3, orientation: "horizontal", length: 3 },
    { id: "a", row: 3, column: 3, orientation: "horizontal", length: 2 },
    { id: "c", row: 4, column: 0, orientation: "horizontal", length: 3 },
    { id: "b", row: 5, column: 1, orientation: "horizontal", length: 2 },
  ],
  fixedAreas: [{ row: 4, column: 4, width: 1, height: 1 }],
  roadOpenings: [
    { side: "up", startOffset: 1, length: 2 },
    { side: "right", startOffset: 3, length: 3 },
    { side: "down", startOffset: 1, length: 3 },
    { side: "left", startOffset: 0, length: 5 },
  ],
};

const missNotice = "これからは出られない向きへ\n動かすとミスになります";

const clearTheWayMessage = "ぶつかる車を先に出します";

const steps: readonly ParkingJamTutorialStep[] = [
  {
    message: {
      headline: "車を出したい向きへ\nスワイプします",
      detail: "前にも後ろにも出せます",
    },
    introducedRuleId: "straight",
    vehicleId: "a",
    exitDirection: "right",
    ruledOutMove: null,
  },
  {
    message: { headline: "道路につながる向きへ出します", detail: null },
    introducedRuleId: "road",
    vehicleId: "b",
    exitDirection: "right",
    ruledOutMove: { vehicleId: "b", direction: "left" },
  },
  {
    message: {
      headline: "植え込みにはぶつかります\n植え込みのない向きへ出します",
      detail: null,
    },
    introducedRuleId: "planter",
    vehicleId: "c",
    exitDirection: "left",
    ruledOutMove: { vehicleId: "c", direction: "right" },
  },
  {
    message: {
      headline: `植え込みだけでなくほかの車にもぶつかります\n${clearTheWayMessage}`,
      detail: null,
    },
    introducedRuleId: "car",
    vehicleId: "d",
    exitDirection: "up",
    ruledOutMove: { vehicleId: "e", direction: "left" },
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

const oppositeDirections = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
} as const satisfies Record<ParkingJamDirection, ParkingJamDirection>;

function findVehicle(vehicleId: ParkingJamVehicleId): ParkingJamVehicle | null {
  return board.vehicles.find(({ id }) => id === vehicleId) ?? null;
}

function listVehicleDirections(
  vehicle: ParkingJamVehicle,
): readonly ParkingJamDirection[] {
  return vehicle.orientation === "horizontal"
    ? ["left", "right"]
    : ["up", "down"];
}

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
        fix: findFix(puzzle, move),
      },
      puzzle,
    ),
    outcome: "violated",
  };
}

function findFix(
  puzzle: ParkingJamState,
  move: ParkingJamMove,
): ParkingJamTutorialFix | null {
  const opposite = {
    vehicleId: move.vehicleId,
    direction: oppositeDirections[move.direction],
  };
  if (listParkingJamMoveBlockers(board, puzzle, opposite).length === 0) {
    return { kind: "opposite" };
  }
  // 問題はどの順に出しても出し切れるので、どちらへも出られない車には、車だけに塞がれた向きが必ずある。
  for (const direction of [move.direction, opposite.direction]) {
    const blockers = listParkingJamMoveBlockers(board, puzzle, {
      vehicleId: move.vehicleId,
      direction,
    });
    const vehicleIds = blockers.flatMap((blocker) =>
      blocker.kind === "vehicle" ? [blocker.vehicleId] : [],
    );
    if (blockers.length > 0 && vehicleIds.length === blockers.length) {
      return { kind: "clear", direction, vehicleIds };
    }
  }
  return null;
}

const directionNames = {
  up: "上",
  right: "右",
  down: "下",
  left: "左",
} as const satisfies Record<ParkingJamDirection, string>;

function describeFix(fix: ParkingJamTutorialFix | null): string | null {
  switch (fix?.kind) {
    case "opposite":
      return "反対の向きへ出します";
    case "clear":
      return `${directionNames[fix.direction]}の車を先に出します`;
    case undefined:
      return null;
  }
}

const violationHeadlines = {
  road: "この先は道路につながっていません",
  planter: "植え込みにぶつかりました",
  car: "ほかの車にぶつかりました",
} as const satisfies Record<ParkingJamTutorialBlocker, string>;

function describeParkingJamTutorialViolation(
  situation: ParkingJamTutorialSituation,
  { lastMove }: ParkingJamTutorialBoardState,
): TutorialMessage {
  if (lastMove?.type !== "blocked") {
    return situation.step?.message ?? parkingJamTutorial.freePlay;
  }
  return {
    headline: violationHeadlines[lastMove.blocker],
    detail: describeFix(lastMove.fix),
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

export function listParkingJamTutorialStepContacts(
  { step }: ParkingJamTutorialSituation,
  { puzzle }: ParkingJamTutorialBoardState,
): ParkingJamTutorialContactedMove[] {
  const vehicle = step && findVehicle(step.vehicleId);
  if (!vehicle) {
    return [];
  }
  return listVehicleDirections(vehicle).flatMap((direction) => {
    const move = { vehicleId: vehicle.id, direction };
    const contact = findParkingJamTutorialContact(puzzle, move);
    return contact ? [{ move, contact }] : [];
  });
}

export function getParkingJamTutorialStepMove({
  step,
}: ParkingJamTutorialSituation): ParkingJamMove | null {
  return step && { vehicleId: step.vehicleId, direction: step.exitDirection };
}

function findMoveBlockedOnlyBy(
  puzzle: ParkingJamState,
  blockerId: ParkingJamVehicleId,
): ParkingJamMove | null {
  for (const vehicleId of puzzle.remainingVehicleIds) {
    const vehicle = findVehicle(vehicleId);
    if (!vehicle || vehicleId === blockerId) {
      continue;
    }
    for (const direction of listVehicleDirections(vehicle)) {
      const move = { vehicleId, direction };
      const blockers = listParkingJamMoveBlockers(board, puzzle, move);
      const onlyBlocker = blockers.length === 1 ? blockers[0] : null;
      if (
        onlyBlocker?.kind === "vehicle" &&
        onlyBlocker.vehicleId === blockerId
      ) {
        return move;
      }
    }
  }
  return null;
}

export function findParkingJamTutorialHint({
  puzzle,
}: ParkingJamTutorialBoardState): {
  vehicleId: ParkingJamVehicleId;
  clearedMove: ParkingJamTutorialContactedMove | null;
} | null {
  const exitableVehicleIds = [
    ...new Set(
      listParkingJamLegalMoves(board, puzzle).map(({ vehicleId }) => vehicleId),
    ),
  ];
  for (const vehicleId of exitableVehicleIds) {
    const move = findMoveBlockedOnlyBy(puzzle, vehicleId);
    const contact = move && findParkingJamTutorialContact(puzzle, move);
    if (move && contact) {
      return { vehicleId, clearedMove: { move, contact } };
    }
  }
  const vehicleId = exitableVehicleIds[0];
  return vehicleId === undefined ? null : { vehicleId, clearedMove: null };
}

export function describeParkingJamTutorialHint(hint: {
  clearedMove: ParkingJamTutorialContactedMove | null;
}): TutorialMessage {
  return {
    headline: hint.clearedMove ? "この車を先に出します" : "この車は今出せます",
    detail: null,
  };
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

export const PARKING_JAM_TUTORIAL_PROGRESS_STEP_COUNT = board.vehicles.length;

export function getParkingJamTutorialProgressRatio({
  puzzle,
}: ParkingJamTutorialBoardState): number {
  const exitedCount =
    PARKING_JAM_TUTORIAL_PROGRESS_STEP_COUNT -
    puzzle.remainingVehicleIds.length;
  return exitedCount / PARKING_JAM_TUTORIAL_PROGRESS_STEP_COUNT;
}

export const parkingJamTutorial: Tutorial<
  ParkingJamTutorialRuleId,
  ParkingJamTutorialStep,
  ParkingJamTutorialBoardState,
  ParkingJamTutorialAction
> = {
  intro: {
    purpose: "駐車場の車を\nすべて道路へ出すパズルです",
    goalCaption: "駐車場を空にすると完成です",
  },
  rules: [
    { id: "straight", label: "車は前か後ろへ出します" },
    { id: "road", label: "道路につながる向きへ出します" },
    { id: "planter", label: "植え込みのない向きへ出します" },
    { id: "car", label: "ぶつかる車を先に出します" },
  ],
  steps,
  freePlay: {
    headline: "残りの車も出してみましょう",
    detail: "本番は出られない向きへ\n動かすとミスになります",
  },
  completion: {
    home: { headline: "完成です", detail: missNotice },
    play: { headline: "完成です", detail: missNotice },
  },
  start: startParkingJamTutorial,
  goal: getParkingJamTutorialGoal,
  perform: performParkingJamTutorialAction,
  describeViolation: describeParkingJamTutorialViolation,
};
