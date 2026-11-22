import {
  assertShuttleParkingLot,
  listShuttleParkingCarCells,
  listShuttleParkingCarExitSides,
  listShuttleParkingPathCells,
  type ShuttleParkingCarId,
  type ShuttleParkingColor,
  type ShuttleParkingLot,
  type ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";

/** 1問のルールに要るものすべて。乗客の列は先頭から並ぶ。 */
export type ShuttleParkingPuzzle = {
  lot: ShuttleParkingLot;
  passengers: readonly ShuttleParkingColor[];
  bayCount: number;
};

export type ShuttleParkingWaitingCar = {
  carId: ShuttleParkingCarId;
  seatedCount: number;
};

export type ShuttleParkingState = {
  /** 駐車場に残る車。`cars` の並び順。 */
  parkedCarIds: readonly ShuttleParkingCarId[];
  /** 待機枠の車。入った順。 */
  waitingCars: readonly ShuttleParkingWaitingCar[];
  /** 乗った乗客の数。列の先頭からこの数だけが乗っている。 */
  boardedCount: number;
};

/** 車が待機枠に入った後に、続けて起きたこと。起きた順。 */
export type ShuttleParkingBoardingEvent =
  | {
      type: "boarded";
      passengerIndex: number;
      carId: ShuttleParkingCarId;
    }
  | { type: "departed"; carId: ShuttleParkingCarId };

export type ShuttleParkingExitBlock =
  | { reason: "bays-full" }
  | { reason: "path-blocked"; blockerIds: readonly ShuttleParkingCarId[] };

export type ShuttleParkingExit =
  | { outcome: "not-parked" }
  | ({ outcome: "blocked" } & ShuttleParkingExitBlock)
  | {
      outcome: "exited";
      side: ShuttleParkingSide;
      state: ShuttleParkingState;
      events: readonly ShuttleParkingBoardingEvent[];
    };

export function createShuttleParkingInitialState(
  puzzle: ShuttleParkingPuzzle,
): ShuttleParkingState {
  return {
    parkedCarIds: puzzle.lot.cars.map((_, carId) => carId),
    waitingCars: [],
    boardedCount: 0,
  };
}

function cellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function mapParkedCells(
  lot: ShuttleParkingLot,
  parkedCarIds: readonly ShuttleParkingCarId[],
): Map<string, ShuttleParkingCarId> {
  const cells = new Map<string, ShuttleParkingCarId>();
  for (const carId of parkedCarIds) {
    for (const { row, column } of listShuttleParkingCarCells(
      lot.cars[carId]!,
    )) {
      cells.set(cellKey(row, column), carId);
    }
  }
  return cells;
}

type ExitRoute =
  | { side: ShuttleParkingSide }
  | { side: null; blockerIds: readonly ShuttleParkingCarId[] };

function findExitRoute(
  lot: ShuttleParkingLot,
  parkedCells: ReadonlyMap<string, ShuttleParkingCarId>,
  carId: ShuttleParkingCarId,
): ExitRoute {
  const car = lot.cars[carId]!;
  const blockerIds = new Set<ShuttleParkingCarId>();
  for (const side of listShuttleParkingCarExitSides(lot, car)) {
    const blockers = listShuttleParkingPathCells(lot, car, side)
      .map(({ row, column }) => parkedCells.get(cellKey(row, column)))
      .filter((blocker) => blocker !== undefined);
    if (blockers.length === 0) {
      return { side };
    }
    for (const blocker of blockers) blockerIds.add(blocker);
  }
  return { side: null, blockerIds: [...blockerIds].sort((a, b) => a - b) };
}

/** 待機枠の車へ、列の先頭から乗れるだけ乗せ、満席の車を出発させる。 */
function boardPassengers(
  puzzle: ShuttleParkingPuzzle,
  waitingCars: readonly ShuttleParkingWaitingCar[],
  boardedCount: number,
): {
  waitingCars: ShuttleParkingWaitingCar[];
  boardedCount: number;
  events: ShuttleParkingBoardingEvent[];
} {
  const { cars } = puzzle.lot;
  const waiting = waitingCars.map((car) => ({ ...car }));
  const events: ShuttleParkingBoardingEvent[] = [];
  let boarded = boardedCount;
  while (boarded < puzzle.passengers.length) {
    const color = puzzle.passengers[boarded];
    const seatIndex = waiting.findIndex(
      ({ carId, seatedCount }) =>
        cars[carId]!.color === color && seatedCount < cars[carId]!.capacity,
    );
    if (seatIndex < 0) break;

    const seat = waiting[seatIndex]!;
    seat.seatedCount += 1;
    events.push({
      type: "boarded",
      passengerIndex: boarded,
      carId: seat.carId,
    });
    boarded += 1;
    if (seat.seatedCount === cars[seat.carId]!.capacity) {
      waiting.splice(seatIndex, 1);
      events.push({ type: "departed", carId: seat.carId });
    }
  }
  return { waitingCars: waiting, boardedCount: boarded, events };
}

export function exitShuttleParkingCar(
  puzzle: ShuttleParkingPuzzle,
  state: ShuttleParkingState,
  carId: ShuttleParkingCarId,
): ShuttleParkingExit {
  if (!state.parkedCarIds.includes(carId)) {
    return { outcome: "not-parked" };
  }
  if (state.waitingCars.length >= puzzle.bayCount) {
    return { outcome: "blocked", reason: "bays-full" };
  }

  const route = findExitRoute(
    puzzle.lot,
    mapParkedCells(puzzle.lot, state.parkedCarIds),
    carId,
  );
  if (route.side === null) {
    return {
      outcome: "blocked",
      reason: "path-blocked",
      blockerIds: route.blockerIds,
    };
  }

  const boarding = boardPassengers(
    puzzle,
    [...state.waitingCars, { carId, seatedCount: 0 }],
    state.boardedCount,
  );
  return {
    outcome: "exited",
    side: route.side,
    state: {
      parkedCarIds: state.parkedCarIds.filter((parked) => parked !== carId),
      waitingCars: boarding.waitingCars,
      boardedCount: boarding.boardedCount,
    },
    events: boarding.events,
  };
}

/** 今出せる車。待機枠が埋まっていれば無い。 */
export function listShuttleParkingExitableCarIds(
  puzzle: ShuttleParkingPuzzle,
  state: ShuttleParkingState,
): ShuttleParkingCarId[] {
  if (state.waitingCars.length >= puzzle.bayCount) return [];

  const parkedCells = mapParkedCells(puzzle.lot, state.parkedCarIds);
  return state.parkedCarIds.filter(
    (carId) => findExitRoute(puzzle.lot, parkedCells, carId).side !== null,
  );
}

/** 全員が乗って、すべての車が出発した。 */
export function isShuttleParkingCleared(
  puzzle: ShuttleParkingPuzzle,
  state: ShuttleParkingState,
): boolean {
  return (
    state.boardedCount === puzzle.passengers.length &&
    state.parkedCarIds.length === 0 &&
    state.waitingCars.length === 0
  );
}

/** クリアしておらず、出せる車が無い。 */
export function isShuttleParkingStuck(
  puzzle: ShuttleParkingPuzzle,
  state: ShuttleParkingState,
): boolean {
  return (
    !isShuttleParkingCleared(puzzle, state) &&
    listShuttleParkingExitableCarIds(puzzle, state).length === 0
  );
}

/** 色ごとに、乗客の数が座席の数と同じであること。 */
export function assertShuttleParkingPuzzle(puzzle: ShuttleParkingPuzzle): void {
  assertShuttleParkingLot(puzzle.lot);
  if (!Number.isInteger(puzzle.bayCount) || puzzle.bayCount < 1) {
    throw new RangeError(
      `Invalid shuttle parking bay count: ${puzzle.bayCount}`,
    );
  }

  const balance = new Map<ShuttleParkingColor, number>();
  for (const { color, capacity } of puzzle.lot.cars) {
    balance.set(color, (balance.get(color) ?? 0) + capacity);
  }
  for (const color of puzzle.passengers) {
    balance.set(color, (balance.get(color) ?? 0) - 1);
  }
  if ([...balance.values()].some((count) => count !== 0)) {
    throw new RangeError(
      "Shuttle parking passengers must match the seats of each color",
    );
  }
}
