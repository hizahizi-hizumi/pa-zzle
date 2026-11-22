import { createShuttleParkingClearability } from "@/games/shuttle-parking/puzzle/clearability";
import {
  exitShuttleParkingCar,
  isShuttleParkingCleared,
  isShuttleParkingStuck,
  listShuttleParkingExitableCarIds,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";
import {
  findShuttleParkingTutorialHintCarId,
  getShuttleParkingTutorialProgressRatio,
  type ShuttleParkingTutorialBoardState,
  type ShuttleParkingTutorialRuleId,
  shuttleParkingTutorial,
  shuttleParkingTutorialProblem,
} from "@/games/shuttle-parking/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type Progress = TutorialProgress<
  ShuttleParkingTutorialRuleId,
  ShuttleParkingTutorialBoardState
>;

const problem = shuttleParkingTutorialProblem;
const { canClear } = createShuttleParkingClearability(problem);

function begin(): Progress {
  return finishTutorialIntro(startTutorial(shuttleParkingTutorial));
}

function tap(progress: Progress, carIds: readonly number[]): Progress {
  return carIds.reduce(
    (current, carId) =>
      performTutorialAction(shuttleParkingTutorial, current, { carId }),
    progress,
  );
}

function message(
  progress: TutorialProgress<"board" | "bays", Progress["boardState"]>,
) {
  return getTutorialMessage(shuttleParkingTutorial, progress, {
    entry: "home",
    violationSettled: true,
  }).headline;
}

function collectReachable(state: ShuttleParkingState): ShuttleParkingState[] {
  const found = [state];
  for (const carId of listShuttleParkingExitableCarIds(problem, state)) {
    const exit = exitShuttleParkingCar(problem, state, carId);
    if (exit.outcome === "exited") found.push(...collectReachable(exit.state));
  }
  return found;
}

describe("手を引く間", () => {
  test("印の車を順に出すと、手順を1つずつ進めること", () => {
    const progress = tap(begin(), [3, 1]);

    expect(progress.stepIndex).toBe(2);
    expect(progress.earnedRuleIds).toEqual(["board", "bays"]);
  });

  test("最初の印の車は先頭の乗客と同じ色で、出すと乗って出発すること", () => {
    const progress = tap(begin(), [3]);

    expect(progress.boardState.state).toMatchObject({
      waitingCars: [],
      boardedCount: 2,
    });
  });

  test("2つ目の印の車は、最初の印の車に塞がれていたこと", () => {
    const blocked = tap(begin(), [1]);

    expect(blocked.violated).toBe(true);
    expect(message(blocked)).toContain("前に車がある");
  });

  test("印と違う出せる車を押すと、盤面を変えずに今の手順を言い直すこと", () => {
    const progress = begin();

    const next = tap(progress, [0]);

    expect(next.boardState.state).toBe(progress.boardState.state);
    expect(message(next)).toBe(
      shuttleParkingTutorial.steps[0]!.message.headline,
    );
  });
});

describe("読みの手順", () => {
  const reading = tap(begin(), [3, 1]);
  const options = listShuttleParkingExitableCarIds(
    problem,
    reading.boardState.state,
  );

  test("印が無く、出せる車が2台以上あること", () => {
    expect(shuttleParkingTutorial.steps[2]!.carId).toBeNull();
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  test("先頭の乗客が乗れない車を出すと詰む手を、盤面を変えずに言葉で返すこと", () => {
    const stranding = options.filter((carId) => {
      const exit = exitShuttleParkingCar(
        problem,
        reading.boardState.state,
        carId,
      );
      return exit.outcome === "exited" && !canClear(exit.state);
    });

    const next = tap(reading, stranding);

    expect(stranding.length).toBeGreaterThan(0);
    expect(next.boardState.state).toBe(reading.boardState.state);
    expect(message(next)).toContain("先頭の乗客が乗れず");
  });

  test("先頭の乗客が乗れる車を出すと手を離し、その後はどう出しても詰まないこと", () => {
    const next = tap(reading, [0]);
    const reachable = collectReachable(next.boardState.state);

    expect(next.stepIndex).toBe(shuttleParkingTutorial.steps.length);
    expect(
      reachable.some((state) => isShuttleParkingStuck(problem, state)),
    ).toBe(false);
  });
});

describe("手を離した後", () => {
  const free = tap(begin(), [3, 1, 0]);

  test("ヒントは全員を送り出せる車を示すこと", () => {
    const carId = findShuttleParkingTutorialHintCarId(free.boardState);

    expect(carId).toBe(2);
  });

  test("残りの車を出すと解けること", () => {
    const solved = tap(free, [2]);

    expect(solved.phase).toBe("solved");
    expect(isShuttleParkingCleared(problem, solved.boardState.state)).toBe(
      true,
    );
    expect(getShuttleParkingTutorialProgressRatio(solved.boardState)).toBe(1);
  });
});

describe("goal", () => {
  test("これから解く1枚で全員を送り出した盤面であること", () => {
    const goal = shuttleParkingTutorial.goal();

    expect(isShuttleParkingCleared(problem, goal.state)).toBe(true);
  });
});
