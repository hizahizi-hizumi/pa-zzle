import { classifyWaterSortDeadlock } from "./deadlock";
import type { WaterSortState } from "./state";

describe("classifyWaterSortDeadlock", () => {
  const noProgressState: WaterSortState = [[0, 0, 0], []];
  const closedCycleState: WaterSortState = [
    [0, 1, 2, 2],
    [3, 4, 2],
  ];
  const beforeTerminalState: WaterSortState = [[0, 0], [1], [2, 1, 1, 1]];
  const terminalState: WaterSortState = [[0, 0], [1, 1, 1, 1], [2]];
  const clearedState: WaterSortState = [[0, 0, 0, 0], []];
  const limitedSearchOptions = { maxVisitedStates: 1 } as const;
  const invalidSearchOptions = { maxVisitedStates: 0 } as const;

  test("異なる盤面へ進めない未クリア状態を手詰まりと判定すること", () => {
    const result = classifyWaterSortDeadlock(noProgressState);

    expect(result).toBe("deadlocked");
  });

  test("別状態を往復するだけの閉じた循環を手詰まりと判定すること", () => {
    const result = classifyWaterSortDeadlock(closedCycleState);

    expect(result).toBe("deadlocked");
  });

  test("先へ進める盤面では案内せず終端へ入ってから手詰まりと判定すること", () => {
    const beforeResult = classifyWaterSortDeadlock(beforeTerminalState);
    const terminalResult = classifyWaterSortDeadlock(terminalState);

    expect(beforeResult).toBe("playable");
    expect(terminalResult).toBe("deadlocked");
  });

  test("クリア状態を手詰まりと判定しないこと", () => {
    const result = classifyWaterSortDeadlock(clearedState);

    expect(result).toBe("playable");
  });

  test("探索上限までに終端循環を確定できなければ判定不能を返すこと", () => {
    const result = classifyWaterSortDeadlock(
      beforeTerminalState,
      limitedSearchOptions,
    );

    expect(result).toBe("unknown");
  });

  test("探索上限に正の整数以外を指定したら拒否すること", () => {
    const act = () =>
      classifyWaterSortDeadlock(beforeTerminalState, invalidSearchOptions);

    expect(act).toThrow(
      "maxVisitedStates must be a positive integer or Infinity",
    );
  });
});
