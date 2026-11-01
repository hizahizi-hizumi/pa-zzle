import {
  createParkingJamInitialState,
  isParkingJamCleared,
  listParkingJamFixedAreaCells,
  listParkingJamVehicleCells,
  type ParkingJamBoard,
  type ParkingJamCell,
  type ParkingJamMove,
  type ParkingJamState,
  type ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  applyParkingJamMove,
  listParkingJamExitPathCells,
  listParkingJamLegalMoves,
  listParkingJamMoveBlockers,
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
 * - `road`: 進む先に道路がない向きへは出られない。
 * - `planter`: 途中に植え込みがあると出られない。
 * - `car`: 途中に車があると出られない。先にその車を出すと通れる。
 */
export type ParkingJamTutorialRuleId = "straight" | "road" | "planter" | "car";

/** 盤面と同じく、車をどちらへ出そうとしたか。 */
export type ParkingJamTutorialAction = ParkingJamMove;

/**
 * 出られなかったわけ。車がまっすぐ進んで最初に当たるもの。
 * - `road`: 進む先に道路がない。
 * - `planter`: 植え込みに当たる。
 * - `car`: 車に当たる。
 */
export type ParkingJamTutorialBlocker = "road" | "planter" | "car";

/**
 * 手順で印を付ける車と、次の手順へ進む手。
 * - `exited`: `vehicleId` の車を出したところで進む。
 * - `blocked`: `vehicleId` の車が `blocker` に当たって出られなかったところで進む。出られないことを反応で体験させる手順に使う。
 */
export type ParkingJamTutorialStep = TutorialStep<ParkingJamTutorialRuleId> & {
  vehicleId: ParkingJamVehicleId;
} & (
    | { endsWhen: "exited" }
    | { endsWhen: "blocked"; blocker: ParkingJamTutorialBlocker }
  );

/**
 * 直前の手。盤面の動きに使う。
 * - `exited`: 車を出した。
 * - `blocked`: 車が `blocker` に当たって出られなかった。
 */
export type ParkingJamTutorialMove = ParkingJamMove &
  (
    | { type: "exited" }
    | { type: "blocked"; blocker: ParkingJamTutorialBlocker }
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
 * 5×5の駐車場に7台。手順の車を順に出すと、出せない向きを1つずつ体験し、最後に塞がれた車を先に開けて出す。
 * 手順を終えると、右上の車・中段右の車と、その車に塞がれた中段左の車が残る。
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
 * - `a`: 右は道路がなく、左は `c` に当たる。`c` を先に出すと左へ出られる。
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
  road: "道路がない向きへは\n出られません",
  planter: "植え込みがあると\n通れません",
  car: "車があると通れません",
} as const satisfies Record<ParkingJamTutorialBlocker, string>;

/**
 * どちらへも出られる車を出させて、操作と、前か後ろへまっすぐ出ていくことを見せる。
 * 次に、道路がない向き・植え込みのある向きを避けて出させる。
 * 最後に、車に塞がれた車を押させて当たるのを見せ、塞いでいる車を先に出させる。
 */
const steps: readonly ParkingJamTutorialStep[] = [
  {
    message: {
      headline: "車を出したい向きへ\nスワイプします",
      detail: "前にも後ろにも進めます",
    },
    introducedRuleId: "straight",
    vehicleId: "e",
    endsWhen: "exited",
  },
  {
    message: { headline: blockerMessages.road, detail: null },
    introducedRuleId: "road",
    vehicleId: "g",
    endsWhen: "exited",
  },
  {
    message: { headline: blockerMessages.planter, detail: null },
    introducedRuleId: "planter",
    vehicleId: "b",
    endsWhen: "exited",
  },
  {
    message: { headline: blockerMessages.car, detail: null },
    introducedRuleId: "car",
    vehicleId: "a",
    endsWhen: "blocked",
    blocker: "car",
  },
  {
    message: { headline: "じゃまな車を先に出します", detail: null },
    introducedRuleId: null,
    vehicleId: "c",
    endsWhen: "exited",
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

function sameCell(left: ParkingJamCell, right: ParkingJamCell): boolean {
  return left.row === right.row && left.column === right.column;
}

/**
 * 出られない手で、車がまっすぐ進んで最初に当たるもの。出られる手と、車の向きに沿わない手は `null`。
 * 本番と同じく、進む先に道路がなければ途中に何があっても道路がないことを先に返す。
 */
export function findParkingJamTutorialBlocker(
  puzzle: ParkingJamState,
  move: ParkingJamMove,
): ParkingJamTutorialBlocker | null {
  const blockers = listParkingJamMoveBlockers(board, puzzle, move);
  const vehicle = board.vehicles.find(({ id }) => id === move.vehicleId);
  if (
    !vehicle ||
    blockers.length === 0 ||
    blockers.some(({ kind }) => kind === "invalid-direction")
  ) {
    return null;
  }
  if (blockers.some(({ kind }) => kind === "wall")) {
    return "road";
  }
  const remainingVehicles = board.vehicles.filter(
    ({ id }) => id !== vehicle.id && puzzle.remainingVehicleIds.includes(id),
  );
  for (const cell of listParkingJamExitPathCells(
    board,
    vehicle,
    move.direction,
  )) {
    if (
      board.fixedAreas.some((area) =>
        listParkingJamFixedAreaCells(area).some((areaCell) =>
          sameCell(areaCell, cell),
        ),
      )
    ) {
      return "planter";
    }
    if (
      remainingVehicles.some((other) =>
        listParkingJamVehicleCells(other).some((otherCell) =>
          sameCell(otherCell, cell),
        ),
      )
    ) {
      return "car";
    }
  }
  return null;
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
 * 手を離した後は本番と同じく、どの車も受け付け、出られない手は手に入れたルールに合わない手として返す。
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
    return {
      state: exited,
      outcome: step?.endsWhen === "exited" ? "stepped" : "continued",
    };
  }

  const blocker = findParkingJamTutorialBlocker(puzzle, move);
  if (blocker === null) {
    return { state, outcome: "ignored" };
  }
  const blocked = withMove(
    state,
    { ...move, type: "blocked", blocker },
    puzzle,
  );
  return {
    state: blocked,
    outcome:
      step?.endsWhen === "blocked" && step.blocker === blocker
        ? "stepped"
        : "violated",
  };
}

/** 出られない手をしたとき。当たったものを、手順でそのルールを示した一言と同じ文で言う。 */
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

export const PARKING_JAM_TUTORIAL_BOARD = board;

export const parkingJamTutorial: Tutorial<
  ParkingJamTutorialRuleId,
  ParkingJamTutorialStep,
  ParkingJamTutorialBoardState,
  ParkingJamTutorialAction
> = {
  intro: {
    purpose: "駐車場の車を\nすべて道路へ出すパズルです",
    goalCaption: "車がすべて出たらゴールです",
    startCaption: "最初は車が詰まっています",
  },
  rules: [
    { id: "straight", label: "前か後ろ" },
    { id: "road", label: "道路" },
    { id: "planter", label: "植え込み" },
    { id: "car", label: "車" },
  ],
  steps,
  freePlay: {
    headline: "残りの車も出すと完成です",
    detail: null,
  },
  completion: {
    selection: {
      headline: "完成です",
      detail: "レベル1は車が増えますが\nルールは同じです",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の駐車場も同じルールで解けます",
    },
  },
  start: startParkingJamTutorial,
  goal: getParkingJamTutorialGoal,
  perform: performParkingJamTutorialAction,
  describeViolation: describeParkingJamTutorialViolation,
};
