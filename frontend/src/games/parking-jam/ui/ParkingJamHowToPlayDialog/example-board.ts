import {
  createParkingJamInitialState,
  type ParkingJamDirection,
  type ParkingJamMove,
  type ParkingJamVehicle,
  type ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  applyParkingJamMove,
  listParkingJamMoveBlockers,
  type ParkingJamMoveBlocker,
} from "@/games/parking-jam/puzzle/rules";
import {
  attemptParkingJamSessionMove,
  createParkingJamSession,
  type ParkingJamSession,
} from "@/games/parking-jam/session/session";
import type {
  ParkingJamHowToPlayBlocker,
  ParkingJamHowToPlayExample,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";

/** 最後に試した手と、本番の session が返した結果。 */
type ParkingJamExampleAttempt =
  | { outcome: "exited"; move: ParkingJamMove }
  | {
      outcome: "blocked";
      move: ParkingJamMove;
      blockers: readonly ParkingJamMoveBlocker[];
    };

/**
 * 触れる例の今の姿。盤面は本番の session で動かすので、出る・当たる・受け付けないが本番と同じになる。
 * 例では経過時間と回数を使わないので、session の時刻と回数は読まない。
 */
export type ParkingJamExampleBoard = {
  session: ParkingJamSession;
  /** 両端に矢印を出している車。本番のプレイと同じく、押すたびに出し入れし、車が出たら消す。 */
  selectedVehicleId: ParkingJamVehicleId | null;
  /** 最後に試した手。車を押して矢印を出し入れしたら、試した手の後に盤面を見直したとして消す。 */
  lastAttempt: ParkingJamExampleAttempt | null;
};

export type ParkingJamExampleMoveMark = ParkingJamMove & { allowed: boolean };

/**
 * 押す所の手がかり。
 * - `vehicle`: 車に付ける。例の打ち方が `swipe` なら出す向きを添える。
 * - `arrow`: 車を押して出た、出す向きの矢印に付ける。
 */
export type ParkingJamExampleHint = ParkingJamMove & {
  target: "vehicle" | "arrow";
};

/**
 * 例の下に添える言葉の中身。
 * - `legend`: 盤面に付いている印の記号の意味。付いている記号だけを持つ。
 * - `exited`: 試した手で、最後の車が出た。出した向きを持つ。
 * - `blocked`: 試した手で車が当たって出られなかった。試した向きと、当たった物の種類をすべて持つ。
 * - `none`: 添える物が無い。
 */
export type ParkingJamExampleCaption =
  | { kind: "legend"; allowed: boolean; disallowed: boolean }
  | { kind: "exited"; direction: ParkingJamDirection }
  | {
      kind: "blocked";
      direction: ParkingJamDirection;
      blockers: readonly ParkingJamHowToPlayBlocker[];
    }
  | { kind: "none" };

const blockerKindOrder: readonly ParkingJamHowToPlayBlocker[] = [
  "wall",
  "fixed-area",
  "vehicle",
];

export function createParkingJamExampleBoard(
  example: ParkingJamHowToPlayExample,
): ParkingJamExampleBoard {
  return {
    session: createParkingJamSession({ board: example.board }, 0),
    selectedVehicleId: null,
    lastAttempt: null,
  };
}

/** 本番のプレイと同じく、残っている車を押すと矢印を出し、同じ車をもう一度押すと消す。 */
export function selectParkingJamExampleVehicle(
  example: ParkingJamExampleBoard,
  vehicleId: ParkingJamVehicleId,
): ParkingJamExampleBoard {
  const { session } = example;
  if (
    session.status !== "playing" ||
    !session.puzzleState.remainingVehicleIds.includes(vehicleId)
  ) {
    return example;
  }
  return {
    ...example,
    selectedVehicleId:
      example.selectedVehicleId === vehicleId ? null : vehicleId,
    lastAttempt: null,
  };
}

/**
 * 本番の session で車を出してみる。受け付けない手は姿を変えない。
 * 出たら矢印を消し、当たったら本番のプレイと同じく矢印を出したままにする。
 */
export function moveParkingJamExampleVehicle(
  example: ParkingJamExampleBoard,
  move: ParkingJamMove,
): ParkingJamExampleBoard {
  const attempt = attemptParkingJamSessionMove(example.session, move, 0);
  switch (attempt.outcome) {
    case "ignored":
      return example;
    case "exited":
      return {
        session: attempt.session,
        selectedVehicleId: null,
        lastAttempt: { outcome: "exited", move },
      };
    case "blocked":
      return {
        ...example,
        session: attempt.session,
        lastAttempt: { outcome: "blocked", move, blockers: attempt.blockers },
      };
  }
}

function listVehicleDirections(
  vehicle: ParkingJamVehicle,
): readonly ParkingJamDirection[] {
  return vehicle.orientation === "horizontal"
    ? ["left", "right"]
    : ["up", "down"];
}

function listRemainingVehicles(
  example: ParkingJamExampleBoard,
): ParkingJamVehicle[] {
  const { problem, puzzleState } = example.session;
  return problem.board.vehicles.filter(({ id }) =>
    puzzleState.remainingVehicleIds.includes(id),
  );
}

function sameMove(left: ParkingJamMove, right: ParkingJamMove): boolean {
  return (
    left.vehicleId === right.vehicleId && left.direction === right.direction
  );
}

/**
 * 残っている車の両端に付ける印。本番の判定で、今の盤面からその向きへ出られるかを求める。
 * 矢印を出している車にも付け、触った後も判定を黙らせない。例が印を付けないとした手には付けない。
 */
export function listParkingJamExampleMoveMarks(
  example: ParkingJamExampleBoard,
  definition: ParkingJamHowToPlayExample,
): ParkingJamExampleMoveMark[] {
  const { problem, puzzleState } = example.session;
  const unmarked = definition.unmarkedMoves ?? [];
  return listRemainingVehicles(example).flatMap((vehicle) =>
    listVehicleDirections(vehicle)
      .map((direction) => ({ vehicleId: vehicle.id, direction }))
      .filter((move) => !unmarked.some((other) => sameMove(other, move)))
      .map((move) => ({
        ...move,
        allowed:
          listParkingJamMoveBlockers(problem.board, puzzleState, move)
            .length === 0,
      })),
  );
}

function sameVehicleIds(
  left: readonly ParkingJamVehicleId[],
  right: readonly ParkingJamVehicleId[],
): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

/**
 * 次に押す所。例が見せる手を最初から順に打っていく途中の盤面でだけ、次の手に付ける。
 * 当たった後は、盤面が変わるか車を押し直すまで付けない。見せる手を打ち終えたら付けない。
 * 次の手の車が矢印を出していれば、出す向きの矢印に付ける。
 */
export function findParkingJamExampleHint(
  example: ParkingJamExampleBoard,
  definition: ParkingJamHowToPlayExample,
): ParkingJamExampleHint | null {
  if (example.lastAttempt?.outcome === "blocked") {
    return null;
  }
  const remaining = example.session.puzzleState.remainingVehicleIds;
  let expected = createParkingJamInitialState(definition.board);
  for (const move of definition.moves) {
    const reached = sameVehicleIds(remaining, expected.remainingVehicleIds);
    expected =
      applyParkingJamMove(definition.board, expected, move) ?? expected;
    if (reached) {
      return {
        ...move,
        target:
          example.selectedVehicleId === move.vehicleId ? "arrow" : "vehicle",
      };
    }
  }
  return null;
}

/**
 * 例の下に添える言葉。当たった手があれば、その向きと当たった物を言う。
 * 出た後は、盤面に印が残っていれば印の意味を言い、残っていなければ出た向きを言う。
 * 出た手の結果より盤面に残る印の意味を先にするのは、出たことは車が走り去る動きで見えるのに対し、
 * 残る印は凡例が無いとどの車の何の答えかを読み違えるため。
 */
export function describeParkingJamExampleCaption(
  example: ParkingJamExampleBoard,
  definition: ParkingJamHowToPlayExample,
): ParkingJamExampleCaption {
  const { lastAttempt } = example;
  if (lastAttempt?.outcome === "blocked") {
    const kinds = new Set(lastAttempt.blockers.map(({ kind }) => kind));
    return {
      kind: "blocked",
      direction: lastAttempt.move.direction,
      blockers: blockerKindOrder.filter((kind) => kinds.has(kind)),
    };
  }
  const marks = listParkingJamExampleMoveMarks(example, definition);
  if (marks.length === 0) {
    return lastAttempt?.outcome === "exited"
      ? { kind: "exited", direction: lastAttempt.move.direction }
      : { kind: "none" };
  }
  return {
    kind: "legend",
    allowed: marks.some(({ allowed }) => allowed),
    disallowed: marks.some(({ allowed }) => !allowed),
  };
}

/** 盤面が最初の姿と違うか。矢印を出し入れしただけでは変わったとみなさない。押し直せば戻せるため。 */
export function isParkingJamExampleChanged(
  example: ParkingJamExampleBoard,
  definition: ParkingJamHowToPlayExample,
): boolean {
  return !sameVehicleIds(
    example.session.puzzleState.remainingVehicleIds,
    definition.board.vehicles.map(({ id }) => id),
  );
}
