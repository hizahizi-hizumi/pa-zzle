import {
  createShuttleParkingClearability,
  createShuttleParkingStateKey,
} from "@/games/shuttle-parking/puzzle/clearability";
import type {
  ShuttleParkingCapacity,
  ShuttleParkingColor,
  ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import reference from "@/games/shuttle-parking/puzzle/research-reference.json";
import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  isShuttleParkingCleared,
  listShuttleParkingExitableCarIds,
  type ShuttleParkingPuzzle,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";

// 期待値は docs/パズル/導入調査/送迎パーキング/調査コード/shuttle-parking_difficulty.expected.json の、
// 解ける最小の待機枠で全部の状態をたどった解（出す順）の数。

type ReferenceProblem = (typeof reference.problems)[number];

function toPuzzle(problem: ReferenceProblem): ShuttleParkingPuzzle {
  return {
    lot: {
      size: problem.size,
      openSides: problem.openSides as ShuttleParkingSide[],
      cars: problem.cars.map(([row, column, orientation, capacity, color]) => ({
        row: row as number,
        column: column as number,
        orientation: orientation === "h" ? "horizontal" : "vertical",
        capacity: capacity as ShuttleParkingCapacity,
        color: color as ShuttleParkingColor,
      })),
    },
    passengers: Array.from(problem.passengers) as ShuttleParkingColor[],
    bayCount: problem.bayCount,
  };
}

function countClearingOrders(puzzle: ShuttleParkingPuzzle): number {
  const known = new Map<string, number>();
  function count(state: ShuttleParkingState): number {
    if (isShuttleParkingCleared(puzzle, state)) return 1;
    const key = createShuttleParkingStateKey(state);
    const cached = known.get(key);
    if (cached !== undefined) return cached;
    const total = listShuttleParkingExitableCarIds(puzzle, state).reduce(
      (sum, carId) => {
        const exit = exitShuttleParkingCar(puzzle, state, carId);
        return exit.outcome === "exited" ? sum + count(exit.state) : sum;
      },
      0,
    );
    known.set(key, total);
    return total;
  }
  return count(createShuttleParkingInitialState(puzzle));
}

describe("調査コードの問題例の場合", () => {
  test.each(
    reference.problems.map((problem) => [problem.seed, problem] as const),
  )(
    "%s は全部の状態をたどった解の数が調査コードと一致すること",
    (_, problem) => {
      const puzzle = toPuzzle(problem);

      const solutionCount = countClearingOrders(puzzle);

      expect(solutionCount).toBe(problem.solutionCount);
    },
  );

  test.each(
    reference.problems.map((problem) => [problem.seed, problem] as const),
  )("%s は待機枠を1つ減らすと解けないこと", (_, problem) => {
    const puzzle = toPuzzle(problem);
    const narrowPuzzle = { ...puzzle, bayCount: puzzle.bayCount - 1 };

    const clearable = createShuttleParkingClearability(narrowPuzzle).canClear(
      createShuttleParkingInitialState(narrowPuzzle),
    );

    expect(clearable).toBe(false);
  });
});

describe("createShuttleParkingClearability", () => {
  // 4×4、上だけが開いている。車0（a）が車1（b）を塞ぐ。
  const puzzle: ShuttleParkingPuzzle = {
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
  const { canClear } = createShuttleParkingClearability(puzzle);

  test("最初の盤面から解けること", () => {
    const clearable = canClear(createShuttleParkingInitialState(puzzle));

    expect(clearable).toBe(true);
  });

  describe("待機枠が1つの場合", () => {
    const narrowPuzzle = { ...puzzle, bayCount: 1 };

    test("どの順でも詰むので解けないこと", () => {
      const clearable = createShuttleParkingClearability(narrowPuzzle).canClear(
        createShuttleParkingInitialState(narrowPuzzle),
      );

      expect(clearable).toBe(false);
    });
  });
});
