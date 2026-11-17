import { validateParkingJamBoard } from "@/games/parking-jam/puzzle/board";
import {
  dispatchLevelProblems,
  pairProblems,
  passengerProblems,
} from "@/games/parking-jam/rule-lab/dispatch-levels";
import {
  analyzeRuleLab,
  createRuleLabState,
} from "@/games/parking-jam/rule-lab/rule-lab";

describe("出庫指令型のレベル別の問題例", () => {
  test("Lv1〜Lv5 の問題がそろっていること", () => {
    expect(
      [
        ...new Set(dispatchLevelProblems.map((problem) => problem.level)),
      ].sort(),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  test.each(
    dispatchLevelProblems.map((problem) => [problem.title, problem] as const),
  )(
    "%s は盤面が正しく、解の数が研究用の探索と一致すること",
    (_title, problem) => {
      const { scenario } = problem;
      expect(() => validateParkingJamBoard(scenario.board)).not.toThrow();
      expect(scenario.queue).toHaveLength(scenario.board.vehicles.length);
      expect([...scenario.queue].sort()).toEqual([...scenario.colors].sort());
      const result = analyzeRuleLab(scenario, createRuleLabState(scenario));
      expect(result.totalWinningSequences).toBe(problem.solutions);
    },
  );
});

describe("乗客列型の問題例", () => {
  test.each(
    passengerProblems.map((problem) => [problem.title, problem] as const),
  )(
    "%s は盤面が正しく、解の数が研究用の探索と一致すること",
    (_title, problem) => {
      const { scenario } = problem;
      expect(() => validateParkingJamBoard(scenario.board)).not.toThrow();
      const seats = scenario.board.vehicles.reduce(
        (total, vehicle) => total + vehicle.length,
        0,
      );
      expect(scenario.queue).toHaveLength(seats);
      const result = analyzeRuleLab(scenario, createRuleLabState(scenario));
      expect(result.totalWinningSequences).toBe(problem.solutions);
    },
  );
});

describe("同色ペア型の問題例", () => {
  test.each(pairProblems.map((problem) => [problem.title, problem] as const))(
    "%s は盤面が正しく、解の数が研究用の探索と一致すること",
    (_title, problem) => {
      const { scenario } = problem;
      expect(() => validateParkingJamBoard(scenario.board)).not.toThrow();
      const result = analyzeRuleLab(scenario, createRuleLabState(scenario));
      expect(result.totalWinningSequences).toBe(problem.solutions);
    },
  );
});
