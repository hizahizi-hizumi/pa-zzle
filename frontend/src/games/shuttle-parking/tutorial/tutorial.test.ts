import { createShuttleParkingClearability } from "@/games/shuttle-parking/puzzle/clearability";
import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  isShuttleParkingCleared,
  isShuttleParkingStuck,
  listShuttleParkingExitableCarIds,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";
import {
  canUndoShuttleParkingTutorial,
  findShuttleParkingTutorialHintCarId,
  getShuttleParkingTutorialProgressRatio,
  SHUTTLE_PARKING_TUTORIAL_SOLUTION,
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
const { steps } = shuttleParkingTutorial;
const { canClear } = createShuttleParkingClearability(problem);

function begin(): Progress {
  return finishTutorialIntro(startTutorial(shuttleParkingTutorial));
}

function tap(progress: Progress, carIds: readonly number[]): Progress {
  return carIds.reduce(
    (current, carId) =>
      performTutorialAction(shuttleParkingTutorial, current, {
        type: "exit",
        carId,
      }),
    progress,
  );
}

function undo(progress: Progress): Progress {
  return performTutorialAction(shuttleParkingTutorial, progress, {
    type: "undo",
  });
}

function message(progress: Progress): string {
  return getTutorialMessage(shuttleParkingTutorial, progress, {
    entry: "home",
    violationSettled: true,
  }).headline;
}

function exitFrom(state: ShuttleParkingState, carId: number) {
  const exit = exitShuttleParkingCar(problem, state, carId);
  return exit.outcome === "exited" ? exit.state : null;
}

function headColor(state: ShuttleParkingState) {
  return problem.passengers[state.boardedCount];
}

describe("手を引く間", () => {
  test("印の車を順に出すと、手順を1つずつ進めて決まりを手に入れること", () => {
    const progress = tap(begin(), [5, 2]);

    expect(progress.stepIndex).toBe(2);
    expect(progress.earnedRuleIds).toEqual(["board", "path", "bays"]);
  });

  test("最初の印の車は先頭の乗客と同じ色で、出すと乗って出発すること", () => {
    const start = begin().boardState.state;

    const after = tap(begin(), [5]).boardState.state;

    expect(problem.lot.cars[5]?.color).toBe(headColor(start));
    expect(after.boardedCount).toBeGreaterThan(0);
    expect(after.waitingCars).toEqual([]);
  });

  test("2つ目の印の車は、最初の印の車に塞がれていて、出した後に出られること", () => {
    const start = begin().boardState.state;
    const afterFirst = tap(begin(), [5]).boardState.state;

    expect(listShuttleParkingExitableCarIds(problem, start)).not.toContain(2);
    expect(listShuttleParkingExitableCarIds(problem, afterFirst)).toContain(2);
  });

  test("前を塞がれた車を押すと、出られないわけを返すこと", () => {
    const blocked = tap(begin(), [2]);

    expect(blocked.violated).toBe(true);
    expect(message(blocked)).toContain("前に車があるので");
  });

  test("印と違う出せる車を押すと、盤面を変えずに印の車を押すよう返すこと", () => {
    const progress = begin();

    const next = tap(progress, [4]);

    expect(next.boardState.state).toBe(progress.boardState.state);
    expect(message(next)).toBe("指さしている車をタップします");
  });

  test("印の車を出す途中の盤面は、詰んでいないこと", () => {
    const states = [
      begin().boardState.state,
      tap(begin(), [5]).boardState.state,
      tap(begin(), [5, 2]).boardState.state,
    ];

    expect(states.every((state) => canClear(state))).toBe(true);
  });

  test("印の車を出した分は「待った」で戻せないこと", () => {
    const progress = tap(begin(), [5, 2]);

    expect(canUndoShuttleParkingTutorial(progress.boardState)).toBe(false);
    expect(undo(progress)).toBe(progress);
  });
});

describe("読みの手順", () => {
  const reading = tap(begin(), [5, 2]);
  const state = reading.boardState.state;
  const options = listShuttleParkingExitableCarIds(problem, state);
  const good = options.filter((carId) => canClear(exitFrom(state, carId)!));
  const bad = options.filter((carId) => !canClear(exitFrom(state, carId)!));

  test("印が無く、先頭の乗客が乗れる車だけが続けられる手であること", () => {
    expect(steps[2]!.carId).toBeNull();
    expect(good.map((carId) => problem.lot.cars[carId]!.color)).toEqual([
      headColor(state),
    ]);
    expect(bad.length).toBeGreaterThan(0);
  });

  describe("先頭の乗客が乗れない車を出した場合", () => {
    const stuck = tap(reading, [bad[0]!]);

    test("盤面を進めて詰ませ、「待った」で戻すよう返すこと", () => {
      expect(isShuttleParkingStuck(problem, stuck.boardState.state)).toBe(true);
      expect(stuck.stepIndex).toBe(2);
      expect(message(stuck)).toContain("出せる車もなくなりました");
    });

    test("「待った」で読みの手順の盤面に戻すこと", () => {
      const undone = undo(stuck);

      expect(undone.boardState.state).toBe(state);
      expect(message(undone)).toBe(steps[2]!.message.headline);
    });
  });

  test("先頭の乗客が乗れる車を出すと手を離し、2台以上が残ること", () => {
    const next = tap(reading, good);

    expect(next.stepIndex).toBe(steps.length);
    expect(next.boardState.state.parkedCarIds.length).toBeGreaterThanOrEqual(2);
  });
});

describe("手を離した後", () => {
  const free = tap(begin(), [5, 2, 0]);
  const state = free.boardState.state;
  const options = listShuttleParkingExitableCarIds(problem, state);

  test("先頭の乗客に合わせる読みがもう一度要ること", () => {
    const strandingColors = options
      .filter((carId) => !canClear(exitFrom(state, carId)!))
      .map((carId) => problem.lot.cars[carId]!.color);

    expect(strandingColors.length).toBeGreaterThan(0);
    expect(strandingColors).not.toContain(headColor(state));
  });

  test("ヒントは全員を送り出せる車を示すこと", () => {
    const carId = findShuttleParkingTutorialHintCarId(free.boardState);

    expect(canClear(exitFrom(state, carId!)!)).toBe(true);
  });

  test("先頭に合わせて出していくと解けること", () => {
    const solved = tap(begin(), SHUTTLE_PARKING_TUTORIAL_SOLUTION);

    expect(solved.phase).toBe("solved");
    expect(getShuttleParkingTutorialProgressRatio(solved.boardState)).toBe(1);
  });
});

describe("goal", () => {
  test("これから解く1枚で全員を送り出した盤面であること", () => {
    const goal = shuttleParkingTutorial.goal();

    expect(isShuttleParkingCleared(problem, goal.state)).toBe(true);
    expect(createShuttleParkingInitialState(problem).parkedCarIds).toHaveLength(
      problem.lot.cars.length,
    );
  });
});

describe("rules", () => {
  test("振り返りの最後で、同じ色が2台なら先に入った車から乗ることを見せること", () => {
    const labels = shuttleParkingTutorial.rules.map(({ label }) => label);

    expect(labels.at(-1)).toBe("同じ色が2台なら先に入った車から乗る");
  });

  test("先に入った車から乗ることは、手順では示さないこと", () => {
    const introduced = shuttleParkingTutorial.steps.map(
      ({ introducedRuleId }) => introducedRuleId,
    );

    expect(introduced).not.toContain("sameColor");
  });
});
