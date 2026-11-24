import { createProblemId } from "@/games/problem-id";
import { listShuttleParkingPoolProblemIds } from "@/games/shuttle-parking/problem/problem-pool";
import {
  canSelectShuttleParkingProblemById,
  selectShuttleParkingProblemById,
  selectShuttleParkingProblemForDifficulty,
} from "@/games/shuttle-parking/problem-selection";

describe("selectShuttleParkingProblemForDifficulty", () => {
  test("同じ seed から同じ問題を選ぶこと", () => {
    const first = selectShuttleParkingProblemForDifficulty("3", "same-seed");

    const second = selectShuttleParkingProblemForDifficulty("3", "same-seed");

    expect(second).toEqual(first);
  });

  test("そのレベルの問題集から選ぶこと", () => {
    const selected = selectShuttleParkingProblemForDifficulty("4", "level-4");

    expect(listShuttleParkingPoolProblemIds("4")).toContain(
      createProblemId(selected.identity),
    );
  });
});

describe("selectShuttleParkingProblemById", () => {
  const [problemId] = listShuttleParkingPoolProblemIds("2");

  test("問題IDの問題を復元すること", () => {
    const selected = selectShuttleParkingProblemById("2", problemId!);

    expect(selected && createProblemId(selected.identity)).toBe(problemId);
    expect(canSelectShuttleParkingProblemById("2", problemId!)).toBe(true);
  });

  test("問題集に無い問題IDには null を返すこと", () => {
    const selected = selectShuttleParkingProblemById("2", "unknown");

    expect(selected).toBeNull();
    expect(canSelectShuttleParkingProblemById("2", "unknown")).toBe(false);
  });
});
