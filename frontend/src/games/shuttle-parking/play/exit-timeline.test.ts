import {
  createShuttleParkingExitTimeline,
  SHUTTLE_PARKING_BOARD_MS,
  SHUTTLE_PARKING_DEPART_MS,
  SHUTTLE_PARKING_EXIT_MS,
} from "@/games/shuttle-parking/play/exit-timeline";

describe("createShuttleParkingExitTimeline", () => {
  const before = {
    parkedCarIds: [1, 2],
    waitingCars: [{ carId: 0, seatedCount: 1 }],
    boardedCount: 3,
  };
  const timeline = createShuttleParkingExitTimeline(before, 2, [
    { type: "boarded", passengerIndex: 3, carId: 2 },
    { type: "boarded", passengerIndex: 4, carId: 0 },
    { type: "departed", carId: 0 },
  ]);

  test("出す前の姿・待機枠に着いた姿・1人ずつの乗車・出発の順に並べること", () => {
    const frames = timeline.frames.map(
      ({ atMs, waitingCars, boardedCount, departingCarId }) => ({
        atMs,
        waitingCars,
        boardedCount,
        departingCarId,
      }),
    );

    expect(frames).toEqual([
      {
        atMs: 0,
        waitingCars: [{ carId: 0, seatedCount: 1 }],
        boardedCount: 3,
        departingCarId: null,
      },
      {
        atMs: SHUTTLE_PARKING_EXIT_MS,
        waitingCars: [
          { carId: 0, seatedCount: 1 },
          { carId: 2, seatedCount: 0 },
        ],
        boardedCount: 3,
        departingCarId: null,
      },
      {
        atMs: SHUTTLE_PARKING_EXIT_MS + SHUTTLE_PARKING_BOARD_MS,
        waitingCars: [
          { carId: 0, seatedCount: 1 },
          { carId: 2, seatedCount: 1 },
        ],
        boardedCount: 4,
        departingCarId: null,
      },
      {
        atMs: SHUTTLE_PARKING_EXIT_MS + 2 * SHUTTLE_PARKING_BOARD_MS,
        waitingCars: [
          { carId: 0, seatedCount: 2 },
          { carId: 2, seatedCount: 1 },
        ],
        boardedCount: 5,
        departingCarId: null,
      },
      {
        atMs: SHUTTLE_PARKING_EXIT_MS + 2 * SHUTTLE_PARKING_BOARD_MS,
        waitingCars: [
          { carId: 0, seatedCount: 2 },
          { carId: 2, seatedCount: 1 },
        ],
        boardedCount: 5,
        departingCarId: 0,
      },
      {
        atMs:
          SHUTTLE_PARKING_EXIT_MS +
          2 * SHUTTLE_PARKING_BOARD_MS +
          SHUTTLE_PARKING_DEPART_MS,
        waitingCars: [{ carId: 2, seatedCount: 1 }],
        boardedCount: 5,
        departingCarId: null,
      },
    ]);
  });

  test("最後の出発を終える時刻を全体の長さにすること", () => {
    expect(timeline.durationMs).toBe(
      SHUTTLE_PARKING_EXIT_MS +
        2 * SHUTTLE_PARKING_BOARD_MS +
        SHUTTLE_PARKING_DEPART_MS,
    );
  });
});
