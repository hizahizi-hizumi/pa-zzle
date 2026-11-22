import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  type ShuttleParkingPuzzle,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";

/** 4×4・上だけが開いた例。赤の車0が青の車1の進路を塞ぎ、青の車2はすぐ出られる。 */
export const shuttleParkingExamplePuzzle: ShuttleParkingPuzzle = {
  lot: {
    size: 4,
    openSides: ["top"],
    cars: [
      { row: 0, column: 0, orientation: "vertical", capacity: 2, color: "a" },
      { row: 2, column: 0, orientation: "vertical", capacity: 2, color: "b" },
      { row: 0, column: 2, orientation: "vertical", capacity: 2, color: "b" },
    ],
  },
  passengers: ["b", "a", "b", "a", "b", "b"],
  bayCount: 2,
};

export type ShuttleParkingExampleFigure = {
  puzzle: ShuttleParkingPuzzle;
  state: ShuttleParkingState;
};

function exitInOrder(
  puzzle: ShuttleParkingPuzzle,
  carIds: readonly number[],
): ShuttleParkingExampleFigure {
  const state = carIds.reduce((current, carId) => {
    const exit = exitShuttleParkingCar(puzzle, current, carId);
    if (exit.outcome !== "exited") {
      throw new Error(`Example car ${carId} must exit`);
    }
    return exit.state;
  }, createShuttleParkingInitialState(puzzle));
  return { puzzle, state };
}

const narrowExamplePuzzle: ShuttleParkingPuzzle = {
  ...shuttleParkingExamplePuzzle,
  bayCount: 1,
};

/** ルールごとの、説明する場面。どれもルールの関数で出した盤面。 */
export const shuttleParkingExampleFigures = {
  start: exitInOrder(shuttleParkingExamplePuzzle, []),
  waiting: exitInOrder(shuttleParkingExamplePuzzle, [0]),
  departed: exitInOrder(shuttleParkingExamplePuzzle, [0, 2]),
  cleared: exitInOrder(shuttleParkingExamplePuzzle, [0, 2, 1]),
  baysFull: exitInOrder(narrowExamplePuzzle, [0]),
} as const satisfies Record<string, ShuttleParkingExampleFigure>;
