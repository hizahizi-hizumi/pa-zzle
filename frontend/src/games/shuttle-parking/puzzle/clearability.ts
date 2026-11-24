import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  isShuttleParkingCleared,
  listShuttleParkingExitableCarIds,
  type ShuttleParkingPuzzle,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";

/**
 * 1問でたどる状態の数の上限。車8台・6×6〜7×7・待機枠2〜4の無作為な11,396問と調査コードの問題例77問では、最も多い問題で2,550だった。
 * 問題集の全問が上限の中に収まることを、生成スクリプトの `--verify` と問題集のテストで確かめるので、プレイ中の判定は上限の中で終わる。
 */
export const SHUTTLE_PARKING_STATE_LIMIT = 10_000;

/** 同じ盤面の状態に同じ文字列を返す。乗った数は残りの車と待機枠の座席から決まるので含めない。 */
export function createShuttleParkingStateKey(
  state: ShuttleParkingState,
): string {
  const waiting = state.waitingCars
    .map(({ carId, seatedCount }) => `${carId}.${seatedCount}`)
    .join(",");
  return `${state.parkedCarIds.join(",")}|${waiting}`;
}

function listNextStates(
  puzzle: ShuttleParkingPuzzle,
  state: ShuttleParkingState,
): ShuttleParkingState[] {
  return listShuttleParkingExitableCarIds(puzzle, state).flatMap((carId) => {
    const exit = exitShuttleParkingCar(puzzle, state, carId);
    return exit.outcome === "exited" ? [exit.state] : [];
  });
}

function throwStateLimitError(limit: number): never {
  throw new RangeError(`Shuttle parking problem has more than ${limit} states`);
}

/** 最初の盤面からたどれる状態の数。上限を超えたら `RangeError`。 */
export function countShuttleParkingStates(
  puzzle: ShuttleParkingPuzzle,
  limit = SHUTTLE_PARKING_STATE_LIMIT,
): number {
  const initial = createShuttleParkingInitialState(puzzle);
  const seen = new Set([createShuttleParkingStateKey(initial)]);
  const pending = [initial];
  while (pending.length > 0) {
    for (const next of listNextStates(puzzle, pending.pop()!)) {
      const key = createShuttleParkingStateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      if (seen.size > limit) throwStateLimitError(limit);
      pending.push(next);
    }
  }
  return seen.size;
}

export type ShuttleParkingClearability = {
  /** この状態から、どこかの順で車を出せば全員を送り出せるか。 */
  canClear: (state: ShuttleParkingState) => boolean;
};

/** 問いごとの結果を覚えて、上限の中で状態をたどる。上限を超えたら `RangeError`。 */
export function createShuttleParkingClearability(
  puzzle: ShuttleParkingPuzzle,
  limit = SHUTTLE_PARKING_STATE_LIMIT,
): ShuttleParkingClearability {
  const known = new Map<string, boolean>();

  function canClear(state: ShuttleParkingState): boolean {
    if (isShuttleParkingCleared(puzzle, state)) return true;
    const key = createShuttleParkingStateKey(state);
    const cached = known.get(key);
    if (cached !== undefined) return cached;
    if (known.size >= limit) throwStateLimitError(limit);

    const clearable = listNextStates(puzzle, state).some(canClear);
    known.set(key, clearable);
    return clearable;
  }

  return { canClear };
}
