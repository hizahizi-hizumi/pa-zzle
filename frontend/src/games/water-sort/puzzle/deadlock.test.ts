import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";

describe("classifyWaterSortDeadlock", () => {
  test("異なる盤面へ進めない未クリア状態を手詰まりと判定すること", () => {
    const state: WaterSortState = [[0, 0, 0], []];

    const result = classifyWaterSortDeadlock(state);

    expect(result).toBe("deadlocked");
  });

  test("別状態を往復するだけの閉じた循環を手詰まりと判定すること", () => {
    const state: WaterSortState = [
      [0, 1, 2, 2],
      [3, 4, 2],
    ];

    const result = classifyWaterSortDeadlock(state);

    expect(result).toBe("deadlocked");
  });

  test("先へ進める盤面では案内せず終端へ入ってから手詰まりと判定すること", () => {
    const beforeTerminal: WaterSortState = [[0, 0], [1], [2, 1, 1, 1]];
    const terminal: WaterSortState = [[0, 0], [1, 1, 1, 1], [2]];

    const beforeResult = classifyWaterSortDeadlock(beforeTerminal);
    const terminalResult = classifyWaterSortDeadlock(terminal);

    expect(beforeResult).toBe("playable");
    expect(terminalResult).toBe("deadlocked");
  });

  test("クリア状態を手詰まりと判定しないこと", () => {
    const state: WaterSortState = [[0, 0, 0, 0], []];

    const result = classifyWaterSortDeadlock(state);

    expect(result).toBe("playable");
  });

  test("探索上限までに終端循環を確定できなければ判定不能を返すこと", () => {
    const state: WaterSortState = [[0, 0], [1], [2, 1, 1, 1]];

    const result = classifyWaterSortDeadlock(state, { maxVisitedStates: 1 });

    expect(result).toBe("unknown");
  });

  test("探索上限に正の整数以外を指定したら拒否すること", () => {
    const state: WaterSortState = [[0, 0], [1], [2, 1, 1, 1]];
    function act() {
      return classifyWaterSortDeadlock(state, { maxVisitedStates: 0 });
    }

    expect(act).toThrow(
      "maxVisitedStates must be a positive integer or Infinity",
    );
  });
});
