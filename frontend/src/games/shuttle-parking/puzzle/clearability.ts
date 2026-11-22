import {
  exitShuttleParkingCar,
  isShuttleParkingCleared,
  listShuttleParkingExitableCarIds,
  type ShuttleParkingPuzzle,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";

/** 同じ盤面の状態に同じ文字列を返す。乗った数は残りの車と待機枠の座席から決まるので含めない。 */
export function createShuttleParkingStateKey(
  state: ShuttleParkingState,
): string {
  const waiting = state.waitingCars
    .map(({ carId, seatedCount }) => `${carId}.${seatedCount}`)
    .join(",");
  return `${state.parkedCarIds.join(",")}|${waiting}`;
}

export type ShuttleParkingClearability = {
  /** この状態から、どこかの順で車を出せば全員を送り出せるか。 */
  canClear: (state: ShuttleParkingState) => boolean;
};

/** 1問の状態は数千ほどなので、問いごとの結果を覚えて全部をたどる。 */
export function createShuttleParkingClearability(
  puzzle: ShuttleParkingPuzzle,
): ShuttleParkingClearability {
  const known = new Map<string, boolean>();

  function canClear(state: ShuttleParkingState): boolean {
    if (isShuttleParkingCleared(puzzle, state)) return true;
    const key = createShuttleParkingStateKey(state);
    const cached = known.get(key);
    if (cached !== undefined) return cached;

    const clearable = listShuttleParkingExitableCarIds(puzzle, state).some(
      (carId) => {
        const exit = exitShuttleParkingCar(puzzle, state, carId);
        return exit.outcome === "exited" && canClear(exit.state);
      },
    );
    known.set(key, clearable);
    return clearable;
  }

  return { canClear };
}
