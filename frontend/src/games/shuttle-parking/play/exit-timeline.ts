import type { ShuttleParkingCarId } from "@/games/shuttle-parking/puzzle/lot";
import type {
  ShuttleParkingBoardingEvent,
  ShuttleParkingState,
  ShuttleParkingWaitingCar,
} from "@/games/shuttle-parking/puzzle/rules";

/** 車が駐車場を出て待機枠に着くまで。 */
export const SHUTTLE_PARKING_EXIT_MS = 260;
/** 乗客1人が乗るまで。1手で10人ほど乗ることがあるので、追える範囲で短くする。 */
export const SHUTTLE_PARKING_BOARD_MS = 170;
/** 満席の車が待機枠を出ていくまで。 */
export const SHUTTLE_PARKING_DEPART_MS = 300;

/** 待機枠と乗客の列の、ある時点の見え方。 */
export type ShuttleParkingExitFrame = {
  atMs: number;
  waitingCars: readonly ShuttleParkingWaitingCar[];
  boardedCount: number;
  /** この時点から待機枠を出ていく車。次の時点で待機枠から消える。 */
  departingCarId: ShuttleParkingCarId | null;
};

/** 1回の出庫で起きることを、順に時刻を付けて並べたもの。音と演出が同じ時刻を使う。 */
export type ShuttleParkingExitTimeline = {
  carId: ShuttleParkingCarId;
  frames: readonly ShuttleParkingExitFrame[];
  /** すべての動きを終える時刻。 */
  durationMs: number;
};

/**
 * 出す前の盤面と、出庫に続いて起きたことから、待機枠と列の見え方を時刻順に作る。
 * 最初の時点は出す前の姿、次は車が待機枠に着いた姿で、その後は乗車1人・出発1台ごとに1つずつ進む。
 */
export function createShuttleParkingExitTimeline(
  before: ShuttleParkingState,
  carId: ShuttleParkingCarId,
  events: readonly ShuttleParkingBoardingEvent[],
): ShuttleParkingExitTimeline {
  const frames: ShuttleParkingExitFrame[] = [
    {
      atMs: 0,
      waitingCars: before.waitingCars,
      boardedCount: before.boardedCount,
      departingCarId: null,
    },
  ];
  let waitingCars: readonly ShuttleParkingWaitingCar[] = [
    ...before.waitingCars,
    { carId, seatedCount: 0 },
  ];
  let boardedCount = before.boardedCount;
  let atMs = SHUTTLE_PARKING_EXIT_MS;
  frames.push({ atMs, waitingCars, boardedCount, departingCarId: null });

  for (const event of events) {
    if (event.type === "boarded") {
      atMs += SHUTTLE_PARKING_BOARD_MS;
      waitingCars = waitingCars.map((car) =>
        car.carId === event.carId
          ? { ...car, seatedCount: car.seatedCount + 1 }
          : car,
      );
      boardedCount = event.passengerIndex + 1;
      frames.push({ atMs, waitingCars, boardedCount, departingCarId: null });
    } else {
      frames.push({
        atMs,
        waitingCars,
        boardedCount,
        departingCarId: event.carId,
      });
      atMs += SHUTTLE_PARKING_DEPART_MS;
      waitingCars = waitingCars.filter((car) => car.carId !== event.carId);
      frames.push({ atMs, waitingCars, boardedCount, departingCarId: null });
    }
  }
  return { carId, frames, durationMs: atMs };
}
