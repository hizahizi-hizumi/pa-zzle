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
        generatorVersion: "2",
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
    const { board, goal, position, optimalMoveCount, lastSlide, blockedInput } =
      result.current;

    expect({ width: board.width, height: board.height }).toEqual({
      width: 5,
      height: 5,
    });
    expect(goal).toBe(18);
    expect(position).toBe(17);
    expect(optimalMoveCount).toBe(3);
    expect(lastSlide).toBeNull();
    expect(blockedInput).toBeNull();
  });

  test("滑らせると駒を止まった位置へ動かし、通ったマスを直前の滑りとして渡すこと", () => {
    act(() => result.current.slide("down"));

    expect(result.current.position).toBe(22);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.lastSlide).toMatchObject({
      direction: "down",
      from: 17,
      to: 22,
      path: [22],
      passedGoal: false,
      isClearingMove: false,
      entersTrap: false,
    });
  });

  test("ゴールを通り過ぎた滑りを直前の滑りで知らせること", () => {
    act(() => result.current.slide("right"));

    expect(result.current.lastSlide).toMatchObject({
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
    expect(result.current.blockedInput).toMatchObject({
      direction: "up",
      from: 17,
      stopper: 12,
    });
    expect(result.current.lastSlide).toBeNull();
  });

  test("続けて成立しない向きを選んでも、入力ごとに別の入力として渡すこと", () => {
    act(() => result.current.slide("up"));
    const firstInputId = result.current.blockedInput?.id;

    act(() => result.current.slide("up"));

    expect(result.current.blockedInput?.id).not.toBe(firstInputId);
  });

  describe("滑った後に成立しない向きを選んだ場合", () => {
    let lastSlide: HookResult["lastSlide"];

    beforeEach(() => {
      slideInOrder(result, ["down"]);
      lastSlide = result.current.lastSlide;
    });

    test("直前の滑りを跡の元として残し、成立しなかった向きを別に渡すこと", () => {
      act(() => result.current.slide("down"));

      expect(result.current.lastSlide).toBe(lastSlide);
      expect(result.current.blockedInput).toMatchObject({
        direction: "down",
        from: 22,
        stopper: null,
      });
      expect(result.current.moveCount).toBe(1);
    });

    test("次に滑ると、成立しなかった入力を消すこと", () => {
      slideInOrder(result, ["down", "right"]);

      expect(result.current.blockedInput).toBeNull();
      expect(result.current.lastSlide).toMatchObject({ from: 22, to: 23 });
    });
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

  describe("閉じ込めの外から閉じ込めへ滑り込んだ場合", () => {
    beforeEach(() => {
      slideInOrder(result, ["right"]);
    });

    test("閉じ込めを知らせ、閉じ込めへ入った滑りとして渡すこと", () => {
      const { isTrapped, lastSlide } = result.current;

      expect(isTrapped).toBe(true);
      expect(lastSlide).toMatchObject({ to: 19, entersTrap: true });
    });

    test("閉じ込めの中で滑っても閉じ込めを知らせ続け、閉じ込めへ入った滑りとはしないこと", () => {
      act(() => result.current.slide("left"));

      expect(result.current.isTrapped).toBe(true);
      expect(result.current.lastSlide).toMatchObject({
        from: 19,
        to: 15,
        entersTrap: false,
      });
    });
  });

  test("待ったで直前の位置へ戻し、総手数を減らさず待ったを数えること", () => {
    slideInOrder(result, ["right"]);

    act(() => result.current.undo());

    expect(result.current.position).toBe(17);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.undoCount).toBe(1);
    expect(result.current.isTrapped).toBe(false);
    expect(result.current.lastSlide).toBeNull();
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

    test("クリアして完成演出へ進み、クリアした手を直前の滑りで知らせること", () => {
      const { status, progress, lastSlide } = result.current;

      expect(status).toBe("cleared");
      expect(progress).toBe("clearing");
      expect(lastSlide).toMatchObject({ isClearingMove: true });
    });

    test("取り消した手も含む総手数と最短手数を結果に含めること", () => {
      const { result: playResult } = result.current;

      expect(playResult).toMatchObject({
        moveCount: 4,
        undoCount: 1,
        restartCount: 0,
        optimalMoveCount: 3,
        moveDelta: 1,
      });
    });

    test("取り消した手も数えた総手数で効率を評価し、盤面の形から基準時間を求めること", () => {
      const { result: playResult } = result.current;

      expect(playResult).toMatchObject({
        boardShape: { width: 5, height: 5 },
        speedRule: { fullScoreMs: 12_500, zeroScoreMs: 25_000 },
        score: { breakdown: { efficiency: 45 } },
      });
    });

    test("それ以上の入力を受け付けないこと", () => {
      const { lastSlide, blockedInput } = result.current;

      act(() => result.current.slide("down"));

      expect(result.current.position).toBe(18);
      expect(result.current.lastSlide).toBe(lastSlide);
      expect(result.current.blockedInput).toBe(blockedInput);
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
        generatorVersion: "2",
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

  describe("要素のある問題を渡した場合", () => {
    // 0  1  b
    // 3  c  5
    // 6  7  8
    // 開始位置 0 から右へ滑るともろい岩 2 が崩れ、続けて下へ滑ると薄い氷 4 を通って割る。
    const elementProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard(["..b", ".c.", "..."]),
        start: 0,
        goal: 8,
      },
      identity: {
        generatorVersion: "2",
        seed: "ice-floor-maze-elements",
        conditions: { width: 3, height: 3 },
      },
      optimalMoveCount: 2,
    };

    beforeEach(() => {
      ({ result } = renderHook(() => useIceFloorMazePlay("3", elementProblem)));
    });

    test("崩したもろい岩と割った薄い氷を直前の滑りと今の盤面で渡すこと", () => {
      slideInOrder(result, ["right", "down"]);

      const { lastSlide, cells } = result.current;

      expect(lastSlide).toMatchObject({
        from: 1,
        to: 7,
        crumbledRock: null,
        crackedIce: [4],
      });
      expect(cells[2]).toBe("ice");
      expect(cells[4]).toBe("water");
    });

    test("待ったで割った薄い氷を戻すこと", () => {
      slideInOrder(result, ["right", "down"]);

      act(() => result.current.undo());

      expect(result.current.position).toBe(1);
      expect(result.current.cells[4]).toBe("thin-ice");
    });

    test("要素を変えて開始位置へ戻っても盤面を戻せること", () => {
      slideInOrder(result, ["right", "left"]);

      const { position, canRestart } = result.current;

      expect(position).toBe(0);
      expect(canRestart).toBe(true);
    });
  });

  describe("隣のもろい岩へ押した場合", () => {
    // 0  b  2
    // 3  4  5
    // 6  7  8
    // 開始位置 0 から右は隣のもろい岩に阻まれて1マスも動けない。
    const pushedProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard([".b.", "...", "..."]),
        start: 0,
        goal: 8,
      },
      identity: {
        generatorVersion: "2",
        seed: "ice-floor-maze-pushed",
        conditions: { width: 3, height: 3 },
      },
      optimalMoveCount: 2,
    };

    beforeEach(() => {
      ({ result } = renderHook(() => useIceFloorMazePlay("3", pushedProblem)));
    });

    test("阻んだもろい岩のマスを渡し、もろい岩を崩さないこと", () => {
      act(() => result.current.slide("right"));

      const { blockedInput, cells } = result.current;

      expect(blockedInput).toMatchObject({ direction: "right", stopper: 1 });
      expect(cells[1]).toBe("brittle-rock");
    });
  });

  describe("閉じ込めから崩す滑りで進んだ場合", () => {
    // b  1  S  3
    // #  5  6  7
    // 8  9  10 11
    // b  13 14 15
    // 16 17 G  19
    // 開始位置 2 から右へ滑ると、崩さない滑りでは 3・19・16 を回るだけになる（閉じ込め）。
    // そこから左へ滑るともろい岩 0 を崩して 1 で止まり、詰みのまま崩さない滑りで戻れない先へ進めるようになる。
    const circlingProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard(["b...", "#...", "....", "b...", "...."]),
        start: 2,
        goal: 18,
      },
      identity: {
        generatorVersion: "2",
        seed: "ice-floor-maze-circling",
        conditions: { width: 4, height: 5 },
      },
      optimalMoveCount: 1,
    };

    beforeEach(() => {
      ({ result } = renderHook(() =>
        useIceFloorMazePlay("3", circlingProblem),
      ));
      slideInOrder(result, ["right"]);
    });

    test("閉じ込めへ入った滑りとして知らせること", () => {
      const { isTrapped, lastSlide } = result.current;

      expect(isTrapped).toBe(true);
      expect(lastSlide).toMatchObject({ to: 3, entersTrap: true });
    });

    test("詰みのまま閉じ込めでなくなっても知らせ続けること", () => {
      slideInOrder(result, ["left"]);

      const { isTrapped, lastSlide } = result.current;

      expect(isTrapped).toBe(true);
      expect(lastSlide).toMatchObject({
        to: 1,
        crumbledRock: 0,
        entersTrap: false,
      });
    });

    test("待ったで閉じ込めの前まで戻すと知らせをやめること", () => {
      slideInOrder(result, ["left"]);

      act(() => result.current.undo());
      const trappedAfterFirstUndo = result.current.isTrapped;
      act(() => result.current.undo());

      expect(trappedAfterFirstUndo).toBe(true);
      expect(result.current.isTrapped).toBe(false);
    });
  });

  describe("最初に避ける問題を渡し、最初に引いた seed がその問題を指す場合", () => {
    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed")
        .mockReturnValueOnce("ice-floor-maze-avoided")
        .mockReturnValueOnce("ice-floor-maze-other");
      const avoidedProblemId = createProblemId({
        generatorVersion: "2",
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
