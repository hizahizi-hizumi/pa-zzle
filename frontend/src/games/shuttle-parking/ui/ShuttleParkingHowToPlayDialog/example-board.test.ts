import {
  isShuttleParkingCleared,
  isShuttleParkingStuck,
} from "@/games/shuttle-parking/puzzle/rules";
import { shuttleParkingExampleFigures } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/example-board";

describe("shuttleParkingExampleFigures", () => {
  test("待つ場面では、赤の車が誰も乗せずに待機枠で待つこと", () => {
    const { state } = shuttleParkingExampleFigures.waiting;

    expect(state.waitingCars).toEqual([{ carId: 0, seatedCount: 0 }]);
    expect(state.boardedCount).toBe(0);
  });

  test("出発の場面では、満席になった車が待機枠から出ていること", () => {
    const { state } = shuttleParkingExampleFigures.departed;

    expect(state.waitingCars).toEqual([]);
    expect(state.boardedCount).toBe(4);
  });

  test("待機枠が埋まる場面では、出せる車が無いこと", () => {
    const { puzzle, state } = shuttleParkingExampleFigures.baysFull;

    expect(isShuttleParkingStuck(puzzle, state)).toBe(true);
  });

  test("ゴールの場面では、全員を送り出していること", () => {
    const { puzzle, state } = shuttleParkingExampleFigures.cleared;

    expect(isShuttleParkingCleared(puzzle, state)).toBe(true);
  });
});
