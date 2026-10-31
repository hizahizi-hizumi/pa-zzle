import { act, cleanup, renderHook } from "@testing-library/react";

import { useIceFloorMazePlay } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazePooledProblem } from "@/games/ice-floor-maze/problem/problem-pool";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";

// #  1  #  3  4
// 5  6  7  #  #
// 10 11 #  #  #
// 15 16 S  G  19
// #  21 22 23 #
// 開始位置 17 から下・右・上の3手でゴール 18 に止まる。上は岩ですぐ止まる。
// 右はゴールを通り過ぎて 19 で止まり、19 から行ける 15・5・7 はどれも 19 へ戻れてゴールが無い（閉じ込め）。
vi.mock("@/games/ice-floor-maze/problem-selection", async () => {
  const { parseIceFloorMazeBoard } = await import(
    "@/games/ice-floor-maze/puzzle/board"
  );
  return {
    selectIceFloorMazeProblemForDifficulty: (
      _difficulty: string,
      seed: string,
    ) => ({
      problem: {
        board: parseIceFloorMazeBoard([
          "#.#..",
          "...##",
          "..###",
          ".....",
          "#...#",
        ]),
        start: 17,
        goal: 18,
      },
      identity: {
        generatorVersion: "1",
        seed,
        conditions: { width: 5, height: 5 },
      },
      optimalMoveCount: 3,
    }),
  };
});

const solution: readonly IceFloorMazeDirection[] = ["down", "right", "up"];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type HookResult = ReturnType<typeof useIceFloorMazePlay>;

function slideInOrder(
  result: { current: HookResult },
  directions: readonly IceFloorMazeDirection[],
): void {
  for (const direction of directions) {
    act(() => result.current.slide(direction));
  }
}

describe("useIceFloorMazePlay", () => {
  let result: { current: HookResult };

  beforeEach(() => {
    ({ result } = renderHook(() => useIceFloorMazePlay("1")));
  });

  test("駒を開始位置に置き、盤面・ゴール・最短手数を持って始めること", () => {
    const { board, goal, position, optimalMoveCount, operation } =
      result.current;

    expect({ width: board.width, height: board.height }).toEqual({
      width: 5,
      height: 5,
    });
    expect(goal).toBe(18);
    expect(position).toBe(17);
    expect(optimalMoveCount).toBe(3);
    expect(operation).toBeNull();
  });

  test("滑らせると駒を止まった位置へ動かし、通ったマスを操作の結果として渡すこと", () => {
    act(() => result.current.slide("down"));

    expect(result.current.position).toBe(22);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.operation).toMatchObject({
      type: "slid",
      direction: "down",
      from: 17,
      to: 22,
      path: [22],
      passedGoal: false,
      isClearingMove: false,
    });
  });

  test("ゴールを通り過ぎた滑りを操作の結果で知らせること", () => {
    act(() => result.current.slide("right"));

    expect(result.current.operation).toMatchObject({
      type: "slid",
      to: 19,
      path: [18, 19],
      passedGoal: true,
    });
    expect(result.current.status).toBe("playing");
  });

  test("1マスも動けない向きでは駒も手数も変えず、成立しなかった向きを渡すこと", () => {
    act(() => result.current.slide("up"));

    expect(result.current.position).toBe(17);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.operation).toMatchObject({
      type: "blocked",
      direction: "up",
      from: 17,
    });
  });

  test("続けて成立しない向きを選んでも、入力ごとに別の操作として渡すこと", () => {
    act(() => result.current.slide("up"));
    const firstOperationId = result.current.operation?.id;

    act(() => result.current.slide("up"));

    expect(result.current.operation?.id).not.toBe(firstOperationId);
  });

  test("同じ描画の間に続けて入力した滑りを入力の順にすべて適用すること", () => {
    act(() => {
      for (const direction of solution) {
        result.current.slide(direction);
      }
    });

    expect(result.current.position).toBe(18);
    expect(result.current.moveCount).toBe(3);
    expect(result.current.status).toBe("cleared");
  });

  test("閉じ込められていないプレイ中は閉じ込めを知らせないこと", () => {
    act(() => result.current.slide("down"));

    expect(result.current.isTrapped).toBe(false);
  });

  test("閉じ込められたら知らせること", () => {
    act(() => result.current.slide("right"));

    expect(result.current.isTrapped).toBe(true);
  });

  test("待ったで直前の位置へ戻し、総手数を減らさず待ったを数えること", () => {
    slideInOrder(result, ["right"]);

    act(() => result.current.undo());

    expect(result.current.position).toBe(17);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.undoCount).toBe(1);
    expect(result.current.isTrapped).toBe(false);
    expect(result.current.operation).toBeNull();
  });

  test("盤面を戻すで駒を開始位置へ戻し、総手数を引き継いで回数を数えること", () => {
    slideInOrder(result, ["down", "right"]);

    act(() => result.current.restart());

    expect(result.current.position).toBe(17);
    expect(result.current.moveCount).toBe(2);
    expect(result.current.restartCount).toBe(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRestart).toBe(false);
  });

  test("リセットで同じ問題の新しいプレイを始めること", () => {
    const { problemIdentity } = result.current;
    slideInOrder(result, ["down", "right"]);

    act(() => result.current.replay());

    expect(result.current.problemIdentity).toBe(problemIdentity);
    expect(result.current.position).toBe(17);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.restartCount).toBe(0);
  });

  describe("ゴールで止まった場合", () => {
    beforeEach(() => {
      slideInOrder(result, ["right"]);
      act(() => result.current.undo());
      slideInOrder(result, solution);
    });

    test("クリアして完成演出へ進み、クリアした手を操作の結果で知らせること", () => {
      const { status, progress, operation } = result.current;

      expect(status).toBe("cleared");
      expect(progress).toBe("clearing");
      expect(operation).toMatchObject({ type: "slid", isClearingMove: true });
    });

    test("取り消した手も含む総手数と最短手数を結果に含めること", () => {
      const { result: playResult } = result.current;

      expect(playResult).toMatchObject({
        moveCount: 4,
        undoCount: 1,
        restartCount: 0,
        optimalMoveCount: 3,
      });
    });

    test("それ以上の入力を受け付けないこと", () => {
      const { operation } = result.current;

      act(() => result.current.slide("down"));

      expect(result.current.position).toBe(18);
      expect(result.current.operation).toBe(operation);
    });

    test("完成演出を終えると結果表示へ進むこと", () => {
      act(() => result.current.completeClearAnimation());

      expect(result.current.progress).toBe("result");
    });
  });

  describe("最初の問題を渡した場合", () => {
    const initialProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard(["..#.", "....", "....", "...."]),
        start: 0,
        goal: 1,
      },
      identity: {
        generatorVersion: "1",
        seed: "ice-floor-maze-requested",
        conditions: { width: 4, height: 4 },
      },
      optimalMoveCount: 1,
    };

    test("渡した問題の盤面・identity・最短手数で始めること", () => {
      const requested = renderHook(() =>
        useIceFloorMazePlay("1", initialProblem),
      );

      const { board, goal, position, problemIdentity, optimalMoveCount } =
        requested.result.current;

      expect({
        board,
        goal,
        position,
        problemIdentity,
        optimalMoveCount,
      }).toEqual({
        board: initialProblem.problem.board,
        goal: 1,
        position: 0,
        problemIdentity: initialProblem.identity,
        optimalMoveCount: 1,
      });
    });
  });

  describe("最初に避ける問題を渡し、最初に引いた seed がその問題を指す場合", () => {
    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed")
        .mockReturnValueOnce("ice-floor-maze-avoided")
        .mockReturnValueOnce("ice-floor-maze-other");
      const avoidedProblemId = createProblemId({
        generatorVersion: "1",
        seed: "ice-floor-maze-avoided",
        conditions: { width: 5, height: 5 },
      });
      ({ result } = renderHook(() =>
        useIceFloorMazePlay("1", undefined, avoidedProblemId),
      ));
    });

    test("seed を引き直して避ける問題と別の問題で始めること", () => {
      expect(result.current.problemIdentity.seed).toBe("ice-floor-maze-other");
    });
  });

  describe("別の問題で最初に引いた seed が今と同じ問題を指す場合", () => {
    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed")
        .mockReturnValueOnce("ice-floor-maze-current")
        .mockReturnValueOnce("ice-floor-maze-current")
        .mockReturnValueOnce("ice-floor-maze-other");
      ({ result } = renderHook(() => useIceFloorMazePlay("1")));
    });

    test("seed を引き直して今と別の問題を始めること", () => {
      act(() => result.current.startNewProblem());

      expect(result.current.problemIdentity.seed).toBe("ice-floor-maze-other");
    });
  });
});
